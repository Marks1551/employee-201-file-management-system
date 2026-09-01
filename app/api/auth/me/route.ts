import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/shared/server/api-helpers';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
