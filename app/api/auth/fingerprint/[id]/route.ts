import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/shared/server/api-helpers';
import { deleteCredential } from '@/features/auth/server/webauthn';
import { addAuditLog } from '@/features/audit-log/server/service';
import { roleLabel } from '@/shared/lib/roles';

/** Removes one of the signed-in user's own fingerprints. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const removed = await deleteCredential(user.id, id);
  if (!removed) return NextResponse.json({ error: 'Fingerprint not found.' }, { status: 404 });
  await addAuditLog(user.name, roleLabel(user.role), 'Removed a registered fingerprint');
  return NextResponse.json({ ok: true });
}
