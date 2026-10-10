import { NextResponse } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { markAllNotificationsRead, listNotifications } from "@/features/notifications/server/service";

export async function POST() {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  await markAllNotificationsRead();

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
