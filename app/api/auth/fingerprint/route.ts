import { NextResponse } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { listFingerprintInfo } from '@/features/auth/server/webauthn';

/** Lists the signed-in user's registered fingerprints (devices). */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ fingerprints: await listFingerprintInfo(user.id) });
}
