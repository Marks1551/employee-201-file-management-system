import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/shared/server/api-helpers";
import { changeUsername } from "@/features/users/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

/** Any signed-in user (admin, HR, faculty) can change their own username. */
export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newUsername = typeof body?.newUsername === "string" ? body.newUsername : "";
  if (!currentPassword || !newUsername.trim()) {
    return NextResponse.json({ error: "Enter your new username and current password." }, { status: 400 });
  }

  const result = await changeUsername(user.id, currentPassword, newUsername);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Changed username from "${user.username}" to "${result.username}"`,
  );
  return NextResponse.json({ ok: true, username: result.username });
}
