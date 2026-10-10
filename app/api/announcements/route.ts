import { NextResponse, type NextRequest } from "next/server";
import { requireUser, requireRole } from "@/shared/server/api-helpers";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";
import { listAnnouncements, createAnnouncement, departmentForEmployee } from "@/features/announcements/server/service";

/** HR/admin: every announcement. Faculty: those for everyone plus their own department. */
export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (user.role === "faculty") {
    const department = await departmentForEmployee(user.employeeId);
    // Faculty without a linked employee record only see announcements for everyone.
    return NextResponse.json({ announcements: await listAnnouncements(department || "\u0000none") });
  }
  return NextResponse.json({ announcements: await listAnnouncements() });
}

/** HR posts an announcement. Body: { title, body, department?: string } — no department = everyone. */
export async function POST(request: NextRequest) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const data = await request.json().catch(() => ({}));
  const title = typeof data.title === "string" ? data.title.trim() : "";
  const body = typeof data.body === "string" ? data.body.trim() : "";
  const audience = typeof data.department === "string" && data.department.trim() ? data.department.trim() : "all";
  if (!title || !body) return NextResponse.json({ error: "A title and a message are required." }, { status: 400 });
  if (title.length > 200)
    return NextResponse.json({ error: "The title is too long (200 characters max)." }, { status: 400 });
  if (body.length > 5000)
    return NextResponse.json({ error: "The message is too long (5000 characters max)." }, { status: 400 });

  const announcement = await createAnnouncement({ title, body, audience, createdBy: user.name });
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Posted announcement "${title}" to ${audience === "all" ? "all employees" : audience}`,
  );
  return NextResponse.json({ announcement });
}
