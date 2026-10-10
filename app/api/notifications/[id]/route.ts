import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { markNotificationRead, dismissNotification, listNotifications } from "@/features/notifications/server/service";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  await markNotificationRead(id);

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}

/** Deletes (dismisses) a single notification. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  await dismissNotification(id);

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
