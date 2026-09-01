import { randomUUID } from 'crypto';
import { query, execute } from '@/shared/server/db';
import { fmt } from '@/shared/server/format';
import { roleLabel } from '@/shared/lib/roles';
import type { AuditLogEntry, AuditLogRow } from '@/shared/types';

function mapAuditRow(row: AuditLogRow): AuditLogEntry {
  return { id: row.id, who: row.who, role: row.role, action: row.action, when: fmt(row.created_at) };
}

export async function listAuditLog(): Promise<AuditLogEntry[]> {
  const rows = await query<AuditLogRow>('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 200');
  return rows.map(mapAuditRow);
}

export async function addAuditLog(who: string, role: string, action: string): Promise<void> {
  await execute('INSERT INTO audit_log (id, who, role, action) VALUES (?,?,?,?)', [`a-${randomUUID()}`, who, role, action]);
}

/** Convenience wrapper: logs an action using a user's display name + role label. */
export async function logAs(userRow: { name: string; role: string }, action: string): Promise<void> {
  await addAuditLog(userRow.name, roleLabel(userRow.role), action);
}
