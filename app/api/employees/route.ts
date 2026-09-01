import { NextResponse, type NextRequest } from 'next/server';
import { requireUser, requireRole } from '@/shared/server/api-helpers';
import { listEmployees, createEmployee } from '@/features/employees/server/service';
import { provisionAccountForEmployee } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const employees = await listEmployees();
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const user = await requireRole('hr', 'admin');
  if (user instanceof NextResponse) return user;

  const data = await request.json();
  if (!data.displayName || !data.employeeNumber) {
    return NextResponse.json({ error: 'Full name and employee number are required.' }, { status: 400 });
  }

  const id = await createEmployee(data);
  await addAuditLog(user.name, roleLabel(user.role), `Added employee record for ${data.displayName}`);

  const account = await provisionAccountForEmployee({ employeeId: id, name: data.displayName, email: data.email });
  if (account) {
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      account.emailSent
        ? `Created account (${account.username}) for ${data.displayName} and emailed a setup link`
        : `Created account (${account.username}) for ${data.displayName} — setup email could not be sent`
    );
  }

  return NextResponse.json({ id, accountCreated: !!account, accountEmailSent: !!account?.emailSent });
}
