import { NextResponse, type NextRequest } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import {
  rpConfig,
  takeChallengeCookie,
  findCredentialByCredentialId,
  updateCredentialUsage,
  getUserRow,
  parseTransports,
} from "@/features/auth/server/webauthn";
import { getUserPublic, touchLastActive } from "@/features/users/server/service";
import { logAs } from "@/features/audit-log/server/service";
import { setSessionCookie } from "@/features/auth/server/session";

const GENERIC_FAILURE = "Fingerprint not recognized. Please try again, or sign in with your password.";

/** Step 2 of fingerprint sign-in: verifies the signed challenge and starts a normal session. */
export async function POST(request: NextRequest) {
  const { response } = await request.json();
  const challenge = await takeChallengeCookie("login");
  if (!challenge || !response?.id) {
    return NextResponse.json({ error: "Your sign-in session expired. Please try again." }, { status: 400 });
  }

  const stored = await findCredentialByCredentialId(response.id);
  if (!stored) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  const { rpID, origin } = rpConfig(request);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: {
        id: stored.credential_id,
        publicKey: new Uint8Array(stored.public_key),
        counter: Number(stored.counter),
        transports: parseTransports(stored.transports),
      },
    });
  } catch (err) {
    console.error("Fingerprint sign-in verification failed:", err);
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  }

  const userRow = await getUserRow(stored.user_id);
  if (!userRow) return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
  if (userRow.status === "deactivated") {
    return NextResponse.json(
      { error: "This account has been deactivated. Contact your administrator." },
      { status: 403 },
    );
  }

  await updateCredentialUsage(stored.id, verification.authenticationInfo.newCounter);
  await setSessionCookie(userRow.id);
  await touchLastActive(userRow.id);
  await logAs(userRow, "Signed in (fingerprint)");

  const user = await getUserPublic(userRow.id);
  return NextResponse.json({ user });
}
