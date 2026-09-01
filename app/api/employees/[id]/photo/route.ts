import { NextResponse, type NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { requireRole } from '@/shared/server/api-helpers';
import { getEmployee, setEmployeePhoto } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'employees');
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type RouteParams = { params: Promise<{ id: string }> };

async function removeExistingPhotoFiles(id: string): Promise<void> {
  let files: string[] = [];
  try {
    files = await fs.readdir(UPLOAD_DIR);
  } catch {
    return; // directory doesn't exist yet — nothing to remove
  }
  await Promise.all(
    files.filter((f) => f.startsWith(`${id}.`)).map((f) => fs.unlink(path.join(UPLOAD_DIR, f)).catch(() => {}))
  );
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get('photo');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No photo file was provided.' }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: 'Please upload a JPG, PNG, or WEBP image.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Photo must be smaller than 5MB.' }, { status: 400 });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await removeExistingPhotoFiles(id);

  const ext = ALLOWED_TYPES[file.type];
  const filename = `${id}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);

  const photoUrl = `/uploads/employees/${filename}?v=${Date.now()}`;
  await setEmployeePhoto(id, photoUrl);
  await addAuditLog(user.name, roleLabel(user.role), `Updated the photo for ${employee.displayName} (#${employee.employeeNumber})`);

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  await removeExistingPhotoFiles(id);
  await setEmployeePhoto(id, null);
  await addAuditLog(user.name, roleLabel(user.role), `Removed the photo for ${employee.displayName} (#${employee.employeeNumber})`);

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
