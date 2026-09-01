import { NextResponse, type NextRequest } from 'next/server';
import { findUserByIdentifier, verifyPassword, getUserPublic, touchLastActive } from '@/features/users/server/service';
import { logAs } from '@/features/audit-log/server/service';
import { setSessionCookie } from '@/features/auth/server/session';

export async function POST(request: NextRequest) {
  const { identifier, password } = await request.json();
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Please enter both your username/employee ID and password.' }, { status: 400 });
  }

  const userRow = await findUserByIdentifier(identifier);
  if (!userRow) {
    return NextResponse.json({ error: 'Incorrect username/employee ID or password.' }, { status: 401 });
  }
  if (userRow.needs_password_setup) {
    return NextResponse.json({ error: 'Please finish setting up your account using the link emailed to you before signing in.' }, { status: 403 });
  }
  if (!(await verifyPassword(userRow, password))) {
    return NextResponse.json({ error: 'Incorrect username/employee ID or password.' }, { status: 401 });
  }
  if (userRow.status === 'deactivated') {
    return NextResponse.json({ error: 'This account has been deactivated. Contact your administrator.' }, { status: 403 });
  }

  await setSessionCookie(userRow.id);
  await touchLastActive(userRow.id);
  await logAs(userRow, 'Signed in');

  const user = await getUserPublic(userRow.id);
  return NextResponse.json({ user });
}
