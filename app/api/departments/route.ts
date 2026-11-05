import { NextResponse, type NextRequest } from "next/server";
import { requireRole, requireUser } from "@/shared/server/api-helpers";
import { addDepartment, listDepartmentDetails, removeDepartment } from "@/features/departments/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

/** Every department an employee can belong to, with how many employees are in each. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const details = await listDepartmentDetails();
  return NextResponse.json({ departments: details.map((d) => d.name), details });
}

/** HR adds a new department (e.g. the school opens a new course). Body: { name: string }. */
export async function POST(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json().catch(() => ({}));
  const result = await addDepartment(typeof data.name === "string" ? data.name : "", user.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await addAuditLog(user.name, roleLabel(user.role), `Added department "${result.name}"`);
  const details = await listDepartmentDetails();
  return NextResponse.json({ ok: true, name: result.name, departments: details.map((d) => d.name), details });
}

/** HR removes a department. Body: { name: string }. Refused while employees still belong to it. */
export async function DELETE(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json().catch(() => ({}));
  const result = await removeDepartment(typeof data.name === "string" ? data.name : "", user.name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await addAuditLog(user.name, roleLabel(user.role), `Removed department "${result.name}"`);
  const details = await listDepartmentDetails();
  return NextResponse.json({ ok: true, name: result.name, departments: details.map((d) => d.name), details });
}
