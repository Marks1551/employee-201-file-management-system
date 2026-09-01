import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { getEmployee, approveEmployeeDocument } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

/** HR/admin approves a faculty-submitted document: the submitted file
 *  becomes the file of record and the document status flips to 'uploaded'. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const docName = await approveEmployeeDocument(id, docId, user.name);
  if (!docName) return NextResponse.json({ error: 'No pending submission was found for that document.' }, { status: 400 });

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Approved "${docName}" submitted by ${employee.displayName} (#${employee.employeeNumber})`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
