// Server-only auth helpers: JWT session tokens stored in an httpOnly cookie.
// Import this only from API routes / server code, never from client components.
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { isProduction } from '@/shared/lib/env';

// Production secret validation lives in instrumentation.ts's register() hook, which only
// runs when the server actually starts (`next start`). It must NOT live here as a
// module-level check — this file gets imported while `next build` compiles routes, and
// `next build` always runs with NODE_ENV=production regardless of deployment mode, so a
// throw here would fail the build itself even when the real production secrets are only
// provided at deploy/runtime (a common setup: build on CI, inject secrets at deploy).

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-in-.env.local';
const COOKIE_NAME = 'e201_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

interface SessionPayload extends jwt.JwtPayload {
  sub: string;
}

export function signSessionToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: MAX_AGE_SECONDS });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string): Promise<void> {
  const token = signSessionToken(userId);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
    secure: isProduction,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** Returns the logged-in user's id (string) or null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  return payload?.sub || null;
}
