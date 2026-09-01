import { NextResponse, type NextRequest } from 'next/server';
import { requireRole, saveDocumentFile, deleteDocumentFile } from '@/shared/server/api-helpers';
import { getEmployee, setTrainingCertificate, clearTrainingCertificate } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string; trainingId: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, trainingId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const training = employee.training.find((t) => t.id === trainingId);
  if (!training) return NextResponse.json({ error: 'Training record not found.' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file was provided.' }, { status: 400 });
  }

  const saved = await saveDocumentFile(file, `${id}/trainings`, trainingId);
  if ('error' in saved) return NextResponse.json({ error: saved.error }, { status: 400 });

  const course = await setTrainingCertificate(id, trainingId, saved);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Uploaded a certificate for training "${course || training.course}" — ${employee.displayName} (#${employee.employeeNumber})`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id, trainingId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const training = employee.training.find((t) => t.id === trainingId);
  if (!training) return NextResponse.json({ error: 'Training record not found.' }, { status: 404 });

  const oldFileUrl = await clearTrainingCertificate(id, trainingId);
  await deleteDocumentFile(oldFileUrl);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed the certificate for training "${training.course}" — ${employee.displayName} (#${employee.employeeNumber})`
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
