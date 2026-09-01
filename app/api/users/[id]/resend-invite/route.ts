import { NextResponse } from 'next/server';
import { requireRole } from '@/shared/server/api-helpers';
import { getUserPublic, resendSetupEmail } from '@/features/users/server/service';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  const user = await requireRole('admin', 'hr');
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const existing = await getUserPublic(id);
  if (!existing) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  if (!existing.needsPasswordSetup) {
    return NextResponse.json({ error: 'This account has already been set up.' }, { status: 400 });
  }

  const sent = await resendSetupEmail(id);
  await addAuditLog(user.name, roleLabel(user.role), `Resent account setup email to ${existing.name}`);
  return NextResponse.json({ ok: true, sent });
}
