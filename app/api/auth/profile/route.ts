import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { updateOwnName, getUserPublic } from "@/features/users/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

/** Admin and HR can change their own display name. Faculty cannot — HR edits
 *  faculty names on the employee record. */
export async function PATCH(request: NextRequest) {
  const user = await requireRole("admin", "hr");
  if (user instanceof NextResponse) return user;

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name : "";

  const result = await updateOwnName(user.id, name);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Changed their display name from "${result.previousName}" to "${name.trim()}"`,
  );
  return NextResponse.json({ user: await getUserPublic(user.id) });
}
