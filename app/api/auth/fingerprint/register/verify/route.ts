import { NextResponse, type NextRequest } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { requireUser } from "@/shared/server/api-helpers";
import { rpConfig, takeChallengeCookie, saveCredential, listCredentialsForUser } from "@/features/auth/server/webauthn";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

const MAX_FINGERPRINTS_PER_USER = 5;

/** Step 2 of fingerprint setup: verifies what the device created and stores its public key. */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { response, label } = await request.json();
  const challenge = await takeChallengeCookie("register");
  if (!challenge || challenge.userId !== user.id) {
    return NextResponse.json({ error: "Your fingerprint setup session expired. Please try again." }, { status: 400 });
  }

  if ((await listCredentialsForUser(user.id)).length >= MAX_FINGERPRINTS_PER_USER) {
    return NextResponse.json(
      { error: `You can register up to ${MAX_FINGERPRINTS_PER_USER} devices. Remove one first.` },
      { status: 400 },
    );
  }

  const { rpID, origin } = rpConfig(request);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
    });
  } catch (err) {
    console.error("Fingerprint registration verification failed:", err);
    return NextResponse.json({ error: "We could not verify your fingerprint. Please try again." }, { status: 400 });
  }
  if (!verification.verified) {
    return NextResponse.json({ error: "We could not verify your fingerprint. Please try again." }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const cleanLabel =
    String(label || "")
      .trim()
      .slice(0, 100) || "This device";
  try {
    await saveCredential({
      userId: user.id,
      credentialId: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: credential.transports,
      label: cleanLabel,
    });
  } catch {
    return NextResponse.json({ error: "This fingerprint is already registered." }, { status: 409 });
  }

  await addAuditLog(user.name, roleLabel(user.role), `Registered a fingerprint (${cleanLabel})`);
  return NextResponse.json({ ok: true });
}
