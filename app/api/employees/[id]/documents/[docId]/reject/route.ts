import { NextResponse, type NextRequest } from 'next/server';
import { requireRole, deleteDocumentFile } from '@/shared/server/api-helpers';
import { getEmployee, rejectEmployeeDocument } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

/** HR/admin rejects a faculty-submitted document: the submitted file is
 *  discarded (never applied to the record) and the document is flagged
 *  'rejected' with an optional note so faculty knows to resubmit. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null;

  const result = await rejectEmployeeDocument(id, docId, user.name, note);
  if (!result) return NextResponse.json({ error: 'No pending submission was found for that document.' }, { status: 400 });

  await deleteDocumentFile(result.previousPendingFileUrl);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Rejected "${result.name}" submitted by ${employee.displayName} (#${employee.employeeNumber})${note ? ` — ${note}` : ''}`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
