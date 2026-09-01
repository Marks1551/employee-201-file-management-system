import { NextResponse, type NextRequest } from 'next/server';
import { peekSetupToken, consumeSetupToken } from '@/features/auth/server/setup-tokens';
import { setUserPassword, getUserPublic, touchLastActive } from '@/features/users/server/service';
import { setSessionCookie } from '@/features/auth/server/session';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

/** Verifies a token without consuming it, so the page can show a friendly
 *  "this link has expired" message before the person types anything. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const found = await peekSetupToken(token);
  if (!found) return NextResponse.json({ valid: false });

  const user = await getUserPublic(found.userId);
  if (!user) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, name: user.name, username: user.username, purpose: found.purpose });
}

export async function POST(request: NextRequest) {
  const { token, password } = await request.json();
  if (!token || !password || String(password).length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
  }

  const found = await consumeSetupToken(token);
  if (!found) {
    return NextResponse.json({ error: 'This link is invalid or has expired. Please request a new one.' }, { status: 400 });
  }

  await setUserPassword(found.userId, password);
  await setSessionCookie(found.userId);
  await touchLastActive(found.userId);

  const user = await getUserPublic(found.userId);
  if (user) {
    await addAuditLog(user.name, roleLabel(user.role), found.purpose === 'setup' ? 'Completed account setup' : 'Reset account password');
  }
  return NextResponse.json({ user });
}
