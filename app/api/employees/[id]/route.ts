import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, requireRole } from '@/shared/server/api-helpers';
import { getEmployee, updateEmployee, updateEmployeePds, deleteEmployee, setEmployeeStatus } from '@/features/employees/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel, DEACTIVATION_REASONS } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });
  return NextResponse.json({ employee });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const patch = await request.json();
  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  // Status changes (activate/deactivate) go through their own path so the
  // reason + timestamp are set/cleared consistently, and get their own audit entry.
  if ('status' in patch) {
    if (patch.status === 'inactive' && !(DEACTIVATION_REASONS as readonly string[]).includes(patch.deactivationReason)) {
      return NextResponse.json({ error: 'Please select a valid reason for deactivating.' }, { status: 400 });
    }
    await setEmployeeStatus(id, patch.status, patch.deactivationReason);
    await addAuditLog(
      user.name, roleLabel(user.role),
      patch.status === 'inactive'
        ? `Deactivated employee record for ${existing.displayName} (#${existing.employeeNumber}) — ${patch.deactivationReason}`
        : `Reactivated employee record for ${existing.displayName} (#${existing.employeeNumber})`
    );
    delete patch.status;
    delete patch.deactivationReason;
  }

  if ('employeeNumber' in patch && !String(patch.employeeNumber || '').trim()) {
    return NextResponse.json({ error: 'Employee number is required.' }, { status: 400 });
  }

  // PDS-specific fields (CS Form 212 extras) are stored as one JSON blob and
  // merged in separately so the PDS Details form can save one section at a
  // time without needing every field on every request.
  if ('pds' in patch) {
    await updateEmployeePds(id, patch.pds || {});
    await addAuditLog(user.name, roleLabel(user.role), `Updated PDS details for ${existing.displayName} (#${existing.employeeNumber})`);
    delete patch.pds;
  }

  if (Object.keys(patch).length) {
    await updateEmployee(id, patch);
    await addAuditLog(user.name, roleLabel(user.role), `Updated record for ${patch.displayName || existing.displayName}`);
  }

  const employee = await getEmployee(id);
  return NextResponse.json({ employee });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const existing = await getEmployee(id);
  if (!existing) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  await deleteEmployee(id);
  await addAuditLog(
    user.name, roleLabel(user.role),
    `Deleted employee record for ${existing.displayName} (#${existing.employeeNumber})`
  );

  return NextResponse.json({ ok: true });
}
