import { NextResponse, type NextRequest } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { rpConfig, setChallengeCookie } from "@/features/auth/server/webauthn";

/** Step 1 of fingerprint sign-in. No username needed: allowCredentials is left empty so the
 *  device shows whichever fingerprint accounts it holds for this site. */
export async function POST(request: NextRequest) {
  const { rpID } = rpConfig(request);
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
  await setChallengeCookie({ challenge: options.challenge, purpose: "login" });
  return NextResponse.json(options);
}
