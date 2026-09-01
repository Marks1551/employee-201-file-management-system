import { NextResponse, type NextRequest } from 'next/server';
import { requestPasswordReset } from '@/features/users/server/service';

/** Always returns a generic success response, whether or not the identifier
 *  matched an account, so this can't be used to test which emails/usernames
 *  are registered. */
export async function POST(request: NextRequest) {
  const { identifier } = await request.json();
  if (!identifier || !String(identifier).trim()) {
    return NextResponse.json({ error: 'Please enter your username or email address.' }, { status: 400 });
  }

  await requestPasswordReset(String(identifier).trim());
  return NextResponse.json({ ok: true });
}
