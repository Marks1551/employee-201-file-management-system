import { NextResponse, type NextRequest } from 'next/server';
import { requireRole, saveDocumentFile, deleteDocumentFile } from '@/shared/server/api-helpers';
import { getEmployee, markDocumentUploaded, clearDocumentFile } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';
import type { StoredFile } from '@/shared/types';

type RouteParams = { params: Promise<{ id: string; docId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file');

  let fileInfo: StoredFile | undefined;
  if (file && typeof file !== 'string') {
    const saved = await saveDocumentFile(file, id, docId);
    if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
    fileInfo = saved;
  }

  const docName = await markDocumentUploaded(id, docId, fileInfo);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Uploaded "${docName || 'a document'}" for ${employee.displayName} (#${employee.employeeNumber})`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, docId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const doc = employee.documents.find((d) => d.id === docId);
  const oldFileUrl = await clearDocumentFile(id, docId);
  await deleteDocumentFile(oldFileUrl);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed "${doc?.name || 'a document'}" for ${employee.displayName} (#${employee.employeeNumber})`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
