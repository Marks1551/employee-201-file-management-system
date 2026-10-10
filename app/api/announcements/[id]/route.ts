import { NextResponse } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";
import { deleteAnnouncement } from "@/features/announcements/server/service";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const ok = await deleteAnnouncement(id);
  if (!ok) return NextResponse.json({ error: "Announcement not found." }, { status: 404 });
  await addAuditLog(user.name, roleLabel(user.role), "Deleted an announcement");
  return NextResponse.json({ ok: true });
}
