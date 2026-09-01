import { NextResponse } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { getAllMeta } from '@/shared/server/meta';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const meta = await getAllMeta();
  return NextResponse.json({ meta });
}
