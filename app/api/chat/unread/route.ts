import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { countUnread } from '@/features/chat/server/service';

export async function GET() {
  const user = await requireRole('hr', 'faculty');
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ unread: await countUnread(user.id) });
}
