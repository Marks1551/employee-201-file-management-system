import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { createAccountForEmployeeNumber, createAccountDirect } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

export async function POST(request: NextRequest) {
  const user = await requireRole('admin');
  if (user instanceof NextResponse) return user;

  const { employeeNumber, name, email, role } = await request.json();
  if (!['admin', 'hr', 'faculty'].includes(role)) {
    return NextResponse.json({ error: 'A valid role is required.' }, { status: 400 });
  }

  const hasEmployeeNumber = !!(employeeNumber && String(employeeNumber).trim());

  // Faculty accounts always link back to a 201 file — that's how their
  // dashboard and documents get scoped. HR/Admin staff aren't tracked as
  // employees in this system, so an employee number is optional for them.
  if (role === 'faculty' && !hasEmployeeNumber) {
    return NextResponse.json({ error: 'Employee number is required for faculty accounts.' }, { status: 400 });
  }

  const result = hasEmployeeNumber
    ? await createAccountForEmployeeNumber(String(employeeNumber).trim(), role)
    : await createAccountDirect({ name: String(name || ''), email: String(email || ''), role });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    result.emailSent
      ? `Created account (${result.username}) ${hasEmployeeNumber ? `for employee #${employeeNumber}` : `for ${name}`} and emailed a setup link`
      : `Created account (${result.username}) ${hasEmployeeNumber ? `for employee #${employeeNumber}` : `for ${name}`} — setup email could not be sent`
  );
  return NextResponse.json({ userId: result.userId, username: result.username, emailSent: result.emailSent });
}
