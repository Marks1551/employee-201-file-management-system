import { NextResponse } from "next/server";
import { requireUser, requireRole } from "@/shared/server/api-helpers";
import {
  listNotifications,
  listNotificationsForEmployee,
  dismissAllNotifications,
} from "@/features/notifications/server/service";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  // The shared notification list is HR's. Faculty only get the timestamps of their own alerts
  // (the bell itself is built from their 201 file), never anyone else's.
  if (user.role === "faculty") {
    const own = user.employeeId ? await listNotificationsForEmployee(user.employeeId) : [];
    return NextResponse.json({ notifications: own });
  }

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}

/** Deletes (dismisses) all notifications. */
export async function DELETE() {
  const user = await requireRole("hr", "admin");
  if (user instanceof NextResponse) return user;

  await dismissAllNotifications();

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
