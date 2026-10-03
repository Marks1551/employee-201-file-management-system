import { NextResponse } from "next/server";
import { requireUser } from "@/shared/server/api-helpers";
import { listNotifications, dismissAllNotifications } from "@/features/notifications/server/service";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}

/** Deletes (dismisses) all notifications. */
export async function DELETE() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  await dismissAllNotifications();

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
