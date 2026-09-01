import { NextResponse } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { markAllNotificationsRead, listNotifications } from '@/features/notifications/server/service';

export async function POST() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  await markAllNotificationsRead();

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
