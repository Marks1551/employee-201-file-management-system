// Server-only helpers for fingerprint (WebAuthn / passkey) login.
//
// How it works: the browser asks the device to create a key pair that is unlocked by the
// device's own fingerprint sensor (Windows Hello, Touch ID, Android biometrics...). We only
// ever store the PUBLIC key. At sign-in the device proves it holds the private key by signing
// a one-time challenge — no username or password involved, and no fingerprint data ever
// reaches this server.
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { query, execute } from "@/shared/server/db";
import { isProduction } from "@/shared/lib/env";
import { appUrl } from "@/features/mailer/server/service";
import { signShortLivedToken, verifyShortLivedToken } from "@/features/auth/server/session";
import type { UserRow } from "@/shared/types";

export const RP_NAME = "Employee 201 File Management System";

/** The "relying party" identity the credentials are bound to. It must match the address the
 *  browser is actually on, otherwise the browser refuses ("The RP ID ... is invalid for this
 *  domain").
 *
 *  - Development (`next dev`): taken from the incoming request, so localhost, a LAN address or
 *    an ngrok URL all just work without touching any settings.
 *  - Production: taken from WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN if set, otherwise from APP_URL.
 *    (Production never trusts request headers for this.)
 *
 *  A fingerprint is tied to the domain it was registered on — one registered on localhost
 *  won't work on an ngrok address, and vice versa. Changing the production domain later
 *  invalidates every registered fingerprint. */
export function rpConfig(request?: Request): { rpID: string; origin: string } {
  if (process.env.WEBAUTHN_RP_ID || process.env.WEBAUTHN_ORIGIN) {
    const url = new URL(appUrl());
    return {
      rpID: process.env.WEBAUTHN_RP_ID || url.hostname,
      origin: process.env.WEBAUTHN_ORIGIN || url.origin,
    };
  }

  if (!isProduction && request) {
    const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim();
    if (host) {
      const hostname = host.replace(/:\d+$/, "");
      const forwardedProto = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim();
      const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
      const proto = forwardedProto || (isLocal ? "http" : "https");
      return { rpID: hostname, origin: `${proto}://${host}` };
    }
  }

  const url = new URL(appUrl());
  return { rpID: url.hostname, origin: url.origin };
}

// ---------- challenge cookie ----------

const CHALLENGE_COOKIE = "e201_webauthn";
const CHALLENGE_TTL_SECONDS = 5 * 60;

type ChallengePayload = { challenge: string; purpose: "register" | "login"; userId?: string };

export async function setChallengeCookie(payload: ChallengePayload): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, signShortLivedToken(payload, CHALLENGE_TTL_SECONDS), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL_SECONDS,
    secure: isProduction,
  });
}

/** Reads AND clears the challenge cookie, so each challenge can only be used once. */
export async function takeChallengeCookie(purpose: ChallengePayload["purpose"]): Promise<ChallengePayload | null> {
  const store = await cookies();
  const token = store.get(CHALLENGE_COOKIE)?.value;
  store.delete(CHALLENGE_COOKIE);
  if (!token) return null;
  const payload = verifyShortLivedToken<ChallengePayload>(token);
  if (!payload || payload.purpose !== purpose) return null;
  return payload;
}

// ---------- credential storage ----------

interface CredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: number | string;
  transports: string | null;
  device_label: string;
  created_at: string;
  last_used_at: string | null;
}

export interface FingerprintInfo {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export async function listCredentialsForUser(userId: string): Promise<CredentialRow[]> {
  return query<CredentialRow>("SELECT * FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at ASC", [userId]);
}

export async function listFingerprintInfo(userId: string): Promise<FingerprintInfo[]> {
  const rows = await listCredentialsForUser(userId);
  return rows.map((r) => ({ id: r.id, label: r.device_label, createdAt: r.created_at, lastUsedAt: r.last_used_at }));
}

export async function findCredentialByCredentialId(credentialId: string): Promise<CredentialRow | null> {
  const rows = await query<CredentialRow>("SELECT * FROM webauthn_credentials WHERE credential_id = ?", [credentialId]);
  return rows[0] || null;
}

export async function saveCredential(params: {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: string[];
  label: string;
}): Promise<string> {
  const id = `fp-${randomUUID()}`;
  await execute(
    `INSERT INTO webauthn_credentials (id, user_id, credential_id, public_key, counter, transports, device_label)
     VALUES (?,?,?,?,?,?,?)`,
    [
      id,
      params.userId,
      params.credentialId,
      Buffer.from(params.publicKey),
      params.counter,
      (params.transports || []).join(","),
      params.label,
    ],
  );
  return id;
}

export async function updateCredentialUsage(id: string, counter: number): Promise<void> {
  await execute("UPDATE webauthn_credentials SET counter = ?, last_used_at = NOW() WHERE id = ?", [counter, id]);
}

/** Deletes one of the user's own credentials. Returns false if it doesn't exist / isn't theirs. */
export async function deleteCredential(userId: string, id: string): Promise<boolean> {
  const result = await execute("DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?", [id, userId]);
  return result.affectedRows > 0;
}

export async function getUserRow(userId: string): Promise<UserRow | null> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  return rows[0] || null;
}

/** Converts the stored comma-separated transports back to the array the library expects. */
export function parseTransports(value: string | null): string[] | undefined {
  const list = (value || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return list.length ? list : undefined;
}
