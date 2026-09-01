import { NextResponse, type NextRequest } from 'next/server';
import { query } from '@/shared/server/db';
import { getUserPublic, touchLastActive } from '@/features/users/server/service';
import { logAs } from '@/features/audit-log/server/service';
import { setSessionCookie } from '@/features/auth/server/session';
import { isProduction } from '@/shared/lib/env';
import type { UserRow } from '@/shared/types';

// Password-less "sign in as any role" shortcut for local development/demos only.
// Hard-disabled in production — see shared/lib/env.ts for how the mode is set.
export async function POST(request: NextRequest) {
  if (isProduction) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { role } = await request.json();
  if (!['admin', 'hr', 'faculty'].includes(role)) {
    return NextResponse.json({ error: 'Unknown role.' }, { status: 400 });
  }

  const rows = await query<UserRow>("SELECT * FROM users WHERE role = ? AND status = 'active' LIMIT 1", [role]);
  const userRow = rows[0];
  if (!userRow) return NextResponse.json({ error: 'No demo account available for that role.' }, { status: 404 });

  await setSessionCookie(userRow.id);
  await touchLastActive(userRow.id);
  await logAs(userRow, 'Signed in (quick access)');

  const user = await getUserPublic(userRow.id);
  return NextResponse.json({ user });
}
