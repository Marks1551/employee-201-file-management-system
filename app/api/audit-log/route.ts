import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { listAuditLog, addAuditLog } from '@/features/audit-log/server/service';

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const auditLog = await listAuditLog();
  return NextResponse.json({ auditLog });
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const { who, role, action } = await request.json();
  if (!action) return NextResponse.json({ error: 'Action text is required.' }, { status: 400 });

  await addAuditLog(who || user.name, role || user.role, action);
  return NextResponse.json({ ok: true });
}
