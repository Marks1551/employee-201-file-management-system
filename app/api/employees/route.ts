import { NextResponse, type NextRequest } from "next/server";
import { requireUser, requireRole } from "@/shared/server/api-helpers";
import {
  listEmployees,
  createEmployee,
  findEmailConflict,
  findEmployeeNumberConflict,
} from "@/features/employees/server/service";
import { provisionAccountForEmployee } from "@/features/users/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const employees = await listEmployees();
  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json();
  if (!data.displayName || !data.employeeNumber) {
    return NextResponse.json({ error: "Full name and employee number are required." }, { status: 400 });
  }

  data.employeeNumber = String(data.employeeNumber).trim();

  const numberConflict = await findEmployeeNumberConflict(data.employeeNumber);
  if (numberConflict) return NextResponse.json({ error: numberConflict }, { status: 409 });

  const emailConflict = await findEmailConflict(data.email);
  if (emailConflict) return NextResponse.json({ error: emailConflict }, { status: 409 });

  let id: string;
  try {
    id = await createEmployee(data);
  } catch (err) {
    // Two requests can pass the checks above at the same time; the UNIQUE index on
    // employees.employee_number is the final guard, so turn its error into the same message.
    if ((err as { code?: string })?.code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "An employee record with this employee number already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
  await addAuditLog(user.name, roleLabel(user.role), `Added employee record for ${data.displayName}`);

  const account = await provisionAccountForEmployee({ employeeId: id, name: data.displayName, email: data.email });
  if (account) {
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      account.emailSent
        ? `Created account (${account.username}) for ${data.displayName} and emailed a setup link`
        : `Created account (${account.username}) for ${data.displayName} — setup email could not be sent`,
    );
  }

  return NextResponse.json({ id, accountCreated: !!account, accountEmailSent: !!account?.emailSent });
}
