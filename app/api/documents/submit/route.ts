import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { requireUser, saveDocumentFile } from '@/shared/server/api-helpers';
import { submitEmployeeDocument } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';
import type { StoredFile } from '@/shared/types';

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const formData = await request.formData();
  const docTypeName = formData.get('docTypeName') as string | null;
  const employeeIdField = formData.get('employeeId') as string | null;
  const file = formData.get('file');

  if (!docTypeName) return NextResponse.json({ error: 'Document type is required.' }, { status: 400 });

  // Faculty can only submit documents against their own linked employee record.
  // HR/Admin (e.g. submitting on someone's behalf) may pass an employeeId explicitly.
  let employeeId = user.employeeId;
  if ((user.role === 'hr' || user.role === 'admin') && employeeIdField) {
    employeeId = employeeIdField;
  }
  if (!employeeId) {
    return NextResponse.json({ error: 'No employee record is linked to this account.' }, { status: 400 });
  }

  let fileInfo: StoredFile | undefined;
  if (file && typeof file !== 'string') {
    // The document row may not exist yet, so save under a fresh id rather than
    // the eventual document id.
    const saved = await saveDocumentFile(file, employeeId, `submit-${randomUUID()}`);
    if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    fileInfo = saved;
  }

  await submitEmployeeDocument(employeeId, docTypeName, fileInfo);
  await addAuditLog(user.name, roleLabel(user.role), `Submitted "${docTypeName}" for review`);

  return NextResponse.json({ ok: true });
}
