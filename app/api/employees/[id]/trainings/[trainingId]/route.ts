import { NextResponse, type NextRequest } from "next/server";
import { requireHrOrOwnFaculty, requireRole } from "@/shared/server/api-helpers";
import { notifyPdsUpdatedBy } from "@/features/notifications/server/service";
import { getEmployee, updateTraining, archiveTraining } from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string; trainingId: string }> };

/** HR/admin can edit any training; faculty only their own. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, trainingId } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;

  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const patch = await request.json();
  if (patch.certStatus === "expiring" && "expiresOn" in patch && !String(patch.expiresOn ?? "").trim()) {
    return NextResponse.json({ error: "Enter the exact date the certificate expires." }, { status: 400 });
  }

  await updateTraining(id, trainingId, patch);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Updated a training record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Training");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}

/** Archiving a training stays HR/admin only. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id, trainingId } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  await archiveTraining(id, trainingId);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Archived a training record for ${employee.displayName} (#${employee.employeeNumber})`,
  );

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
