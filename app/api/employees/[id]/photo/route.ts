import { NextResponse, type NextRequest } from "next/server";
import { putObject, deleteObjectsWithPrefix } from "@/shared/server/r2";
import { requireRole } from "@/shared/server/api-helpers";
import { getEmployee, setEmployeePhoto } from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

const KEY_PREFIX = "employees";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type RouteParams = { params: Promise<{ id: string }> };

async function removeExistingPhotoObjects(id: string): Promise<void> {
  await deleteObjectsWithPrefix(`${KEY_PREFIX}/${id}.`);
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No photo file was provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: "Please upload a JPG, PNG, or WEBP image." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Photo must be smaller than 5MB." }, { status: 400 });
  }

  await removeExistingPhotoObjects(id);

  const ext = ALLOWED_TYPES[file.type];
  const key = `${KEY_PREFIX}/${id}.${ext}`;
  const url = await putObject(key, file, file.type);

  const photoUrl = `${url}?v=${Date.now()}`;
  await setEmployeePhoto(id, photoUrl);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Updated the photo for ${employee.displayName} (#${employee.employeeNumber})`,
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  await removeExistingPhotoObjects(id);
  await setEmployeePhoto(id, null);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed the photo for ${employee.displayName} (#${employee.employeeNumber})`,
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
