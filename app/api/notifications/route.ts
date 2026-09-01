import { NextResponse } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { listNotifications } from '@/features/notifications/server/service';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const notifications = await listNotifications();
  return NextResponse.json({ notifications });
}
