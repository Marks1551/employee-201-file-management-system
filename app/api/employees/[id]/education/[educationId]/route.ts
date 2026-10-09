import { NextResponse, type NextRequest } from "next/server";
import { requireHrOrOwnFaculty } from "@/shared/server/api-helpers";
import { notifyPdsUpdatedBy } from "@/features/notifications/server/service";
import { getEmployee, updateEducation, deleteEducation } from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string; educationId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, educationId } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const patch = await request.json();
  await updateEducation(id, educationId, patch);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Updated an education record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Educational background");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, educationId } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  await deleteEducation(id, educationId);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed an education record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Educational background");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
