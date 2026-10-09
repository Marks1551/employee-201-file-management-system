import { NextResponse, type NextRequest } from "next/server";
import { requireHrOrOwnFaculty } from "@/shared/server/api-helpers";
import { notifyPdsUpdatedBy } from "@/features/notifications/server/service";
import {
  getEmployee,
  updateCivilServiceEligibility,
  deleteCivilServiceEligibility,
} from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string; eligibilityId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, eligibilityId } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const patch = await request.json();
  await updateCivilServiceEligibility(id, eligibilityId, patch);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Updated a civil service eligibility record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Civil service eligibility");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id, eligibilityId } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  await deleteCivilServiceEligibility(id, eligibilityId);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Removed a civil service eligibility record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Civil service eligibility");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
