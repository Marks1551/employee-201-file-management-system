import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { changeUserPassword } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters.' }, { status: 400 });
  }

  const result = await changeUserPassword(user.id, currentPassword, newPassword);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await addAuditLog(user.name, roleLabel(user.role), 'Changed account password');
  return NextResponse.json({ ok: true });
}
