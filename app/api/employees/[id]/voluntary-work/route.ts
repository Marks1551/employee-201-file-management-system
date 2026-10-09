import { NextResponse, type NextRequest } from "next/server";
import { requireHrOrOwnFaculty } from "@/shared/server/api-helpers";
import { notifyPdsUpdatedBy } from "@/features/notifications/server/service";
import { getEmployee, addVoluntaryWork } from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const raw = await request.json();
  // Blank inputs are stored as NULL (an empty string is not valid for columns like Government Service Y/N).
  const data = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v === "" ? null : v]));
  if (!data.organization || !String(data.organization).trim()) {
    return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
  }

  await addVoluntaryWork(id, data as Parameters<typeof addVoluntaryWork>[1]);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Added a voluntary work record for ${employee.displayName} (#${employee.employeeNumber})`,
  );
  await notifyPdsUpdatedBy(user, id, "Voluntary work");

  const updated = await getEmployee(id);
  return NextResponse.json({ employee: updated });
}
