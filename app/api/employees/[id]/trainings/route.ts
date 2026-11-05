import { NextResponse, type NextRequest } from "next/server";
import { requireHrOrOwnFaculty } from "@/shared/server/api-helpers";
import { notifyPdsUpdatedBy } from "@/features/notifications/server/service";
import { getEmployee, addTraining } from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

/** HR/admin can add a training for anyone; faculty only for their own record. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;

  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const data = await request.json();
  if (!data.course || !data.course.trim()) {
    return NextResponse.json({ error: "Course / training title is required." }, { status: 400 });
  }
  if (data.certStatus === "expiring" && !String(data.expiresOn ?? "").trim()) {
    return NextResponse.json({ error: "Enter the exact date the certificate expires." }, { status: 400 });
  }

  await addTraining(id, data);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Added training "${data.course}" for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Training");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
