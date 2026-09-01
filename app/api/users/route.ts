import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, requireRole } from '@/shared/server/api-helpers';
import { listUsers, createUser } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

export async function GET() {
  // Any signed-in role can read the users list (Layout/AdminDashboard rely on it),
  // but only admins can view /admin/users in the UI.
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const user = await requireRole('admin');
  if (user instanceof NextResponse) return user;

  const data = await request.json();
  if (!data.name || !data.email || !data.username || !data.role) {
    return NextResponse.json({ error: 'Name, email, username, and role are required.' }, { status: 400 });
  }

  const id = await createUser(data);
  await addAuditLog(user.name, roleLabel(user.role), `Created account for ${data.name} (${roleLabel(data.role)})`);
  return NextResponse.json({ id });
}
