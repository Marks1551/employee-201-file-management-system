import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { listContacts } from '@/features/chat/server/service';

/** Contacts the signed-in user may chat with (HR sees Faculty, Faculty sees HR). */
export async function GET() {
  const user = await requireRole('hr', 'faculty');
  if (user instanceof NextResponse) return user;
  const contacts = await listContacts(user);
  return NextResponse.json({ contacts });
}
