import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { getEmployee, addPdsReference } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const data = await request.json();
  if (!data.name || !data.name.trim()) {
    return NextResponse.json({ error: 'Reference name is required.' }, { status: 400 });
  }

  await addPdsReference(id, data);
  await addAuditLog(user.name, roleLabel(user.role), `Added a PDS reference for ${employee.displayName} (#${employee.employeeNumber})`);

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
