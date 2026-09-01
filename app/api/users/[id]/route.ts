import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { getUserPublic, updateUser } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const patch = await request.json();
  const existing = await getUserPublic(id);
  if (!existing) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  await updateUser(id, patch);

  if ('status' in patch) {
    await addAuditLog(
      user.name, roleLabel(user.role),
      `${patch.status === 'active' ? 'Reactivated' : 'Deactivated'} account for ${existing.name}`
    );
  } else if ('role' in patch && patch.role !== existing.role) {
    await addAuditLog(user.name, roleLabel(user.role), `Changed ${existing.name}'s role to ${roleLabel(patch.role)}`);
  }

  const updated = await getUserPublic(id);
  return NextResponse.json({ user: updated });
}
