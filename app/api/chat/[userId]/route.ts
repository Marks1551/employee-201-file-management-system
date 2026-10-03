import { NextResponse, type NextRequest } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import {
  getAllowedPartner,
  getConversation,
  markConversationRead,
  sendMessage,
  MAX_MESSAGE_LENGTH,
} from '@/features/chat/server/service';

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'faculty');
  if (user instanceof NextResponse) return user;

  const { userId } = await params;
  const partner = await getAllowedPartner(user, userId);
  if (!partner) return NextResponse.json({ error: 'You can only chat between HR and Faculty.' }, { status: 403 });

  await markConversationRead(user.id, partner.id);
  const messages = await getConversation(user.id, partner.id);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole('hr', 'faculty');
  if (user instanceof NextResponse) return user;

  const { userId } = await params;
  const partner = await getAllowedPartner(user, userId);
  if (!partner) return NextResponse.json({ error: 'You can only chat between HR and Faculty.' }, { status: 403 });

  const data = await request.json().catch(() => ({}));
  const body = typeof data.body === 'string' ? data.body.trim() : '';
  if (!body) return NextResponse.json({ error: 'Message cannot be empty.' }, { status: 400 });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 });
  }

  await sendMessage(user.id, partner.id, body);
  const messages = await getConversation(user.id, partner.id);
  return NextResponse.json({ messages });
}
