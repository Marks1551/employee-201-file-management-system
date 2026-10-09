import { NextResponse, type NextRequest } from "next/server";
import { requireUser, requireRole, requireHrOrOwnFaculty } from "@/shared/server/api-helpers";
import { notifyPdsUpdated } from "@/features/notifications/server/service";
import { emptyPdsDetails } from "@/shared/types";
import {
  getEmployee,
  updateEmployee,
  updateEmployeePds,
  deleteEmployee,
  setEmployeeStatus,
  findEmailConflict,
} from "@/features/employees/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel, DEACTIVATION_REASONS } from "@/shared/lib/roles";

const NAME_KEYS = ["firstName", "middleName", "lastName", "nameExtension"] as const;

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const user = await requireHrOrOwnFaculty(id);
  if (user instanceof NextResponse) return user;

  const patch = await request.json();
  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  // Faculty can edit only the PDS details of their own record — nothing else
  // (position, department, status, etc. stay HR-only). HR is notified.
  if (user.role === "faculty") {
    const keys = Object.keys(patch);
    if (keys.length !== 1 || keys[0] !== "pds") {
      return NextResponse.json(
        { error: "You can only edit your PDS details. Please contact HR to change other information." },
        { status: 403 },
      );
    }
    const incoming = { ...((patch.pds || {}) as Record<string, unknown>) };
    // The employee's name is HR-only: faculty can edit the rest of their PDS, but never the
    // name fields (even if a request tries to send them).
    for (const k of NAME_KEYS) delete incoming[k];
    const before = { ...emptyPdsDetails(), ...existing.pds } as Record<string, unknown>;
    const changed = Object.keys(incoming).some((k) => JSON.stringify(incoming[k]) !== JSON.stringify(before[k]));
    if (changed) {
      await updateEmployeePds(id, incoming);
      await addAuditLog(user.name, roleLabel(user.role), `Updated their own PDS details (#${existing.employeeNumber})`);
      await notifyPdsUpdated(id, "PDS details");
    }
    const employee = await getEmployee(id);
    return NextResponse.json({ employee });
  }

  // Status changes (activate/deactivate) go through their own path so the
  // reason + timestamp are set/cleared consistently, and get their own audit entry.
  if ("status" in patch) {
    if (
      patch.status === "inactive" &&
      !(DEACTIVATION_REASONS as readonly string[]).includes(patch.deactivationReason)
    ) {
      return NextResponse.json({ error: "Please select a valid reason for deactivating." }, { status: 400 });
    }
    await setEmployeeStatus(id, patch.status, patch.deactivationReason);
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      patch.status === "inactive"
        ? `Deactivated employee record for ${existing.displayName} (#${existing.employeeNumber}) — ${patch.deactivationReason}`
        : `Reactivated employee record for ${existing.displayName} (#${existing.employeeNumber})`,
    );
    delete patch.status;
    delete patch.deactivationReason;
  }

  if ("employeeNumber" in patch && !String(patch.employeeNumber || "").trim()) {
    return NextResponse.json({ error: "Employee number is required." }, { status: 400 });
  }

  if ("email" in patch && String(patch.email || "").trim()) {
    const emailConflict = await findEmailConflict(patch.email, id);
    if (emailConflict) return NextResponse.json({ error: emailConflict }, { status: 409 });
  }

  // PDS-specific fields (CS Form 212 extras) are stored as one JSON blob and
  // merged in separately so the PDS Details form can save one section at a
  // time without needing every field on every request.
  if ("pds" in patch) {
    await updateEmployeePds(id, patch.pds || {});
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      `Updated PDS details for ${existing.displayName} (#${existing.employeeNumber})`,
    );
    delete patch.pds;
  }

  if (Object.keys(patch).length) {
    await updateEmployee(id, patch);
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      `Updated record for ${patch.displayName || existing.displayName}`,
    );
  }

  const employee = await getEmployee(id);
  return NextResponse.json({ employee });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  await deleteEmployee(id);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Deleted employee record for ${existing.displayName} (#${existing.employeeNumber})`,
  );

  return NextResponse.json({ ok: true });
}
