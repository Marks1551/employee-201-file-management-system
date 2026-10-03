import { NextResponse, type NextRequest } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireUser } from "@/shared/server/api-helpers";
import {
  RP_NAME,
  rpConfig,
  setChallengeCookie,
  listCredentialsForUser,
  parseTransports,
} from "@/features/auth/server/webauthn";

/** Step 1 of fingerprint setup (must already be signed in): returns the options the browser
 *  passes to the device to create a new fingerprint-protected credential. */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { rpID } = rpConfig(request);
  const existing = await listCredentialsForUser(user.id);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: user.username,
    userDisplayName: user.name,
    // Stable per-user handle, so the device can offer the right account at sign-in.
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    // Don't let the same device be enrolled twice.
    excludeCredentials: existing.map((c) => ({ id: c.credential_id, transports: parseTransports(c.transports) })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // the device's built-in sensor (not a roaming USB key)
      residentKey: "required", // discoverable credential => sign in without typing a username
      userVerification: "required", // fingerprint/face/PIN check is mandatory
    },
  });

  await setChallengeCookie({ challenge: options.challenge, purpose: "register", userId: user.id });
  return NextResponse.json(options);
}
