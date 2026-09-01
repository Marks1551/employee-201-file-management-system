import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/shared/server/api-helpers';
import { clearSessionCookie } from '@/features/auth/server/session';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

export async function POST() {
  const user = await getCurrentUser();
  if (user) await addAuditLog(user.name, roleLabel(user.role), 'Signed out');
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
