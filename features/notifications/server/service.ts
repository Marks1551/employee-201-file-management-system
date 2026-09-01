import { randomUUID } from 'crypto';
import { query, execute } from '@/shared/server/db';
import { fmt } from '@/shared/server/format';
import type { Notification, NotificationRow } from '@/shared/types';

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    employeeId: row.employee_id,
    documentId: row.document_id,
    trainingId: row.training_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    status: row.status,
    when: fmt(row.created_at),
  };
}

/**
 * Notifications are a persisted entity (not computed on the fly). Whenever a
 * document or training's status changes, this reconciles the notifications
 * table so there's exactly one open notification per outstanding issue —
 * creating new ones, and clearing ones that are no longer relevant. Called
 * from the employees feature after any document/training mutation.
 */
export async function syncNotificationsForEmployee(employeeId: string): Promise<void> {
  const [employeeRows, missingDocs, pendingDocs, expiringTrainings, existing] = await Promise.all([
    query<{ display_name: string; employee_number: string }>('SELECT display_name, employee_number FROM employees WHERE id = ?', [employeeId]),
    query<{ id: string; name: string }>("SELECT id, name FROM documents WHERE employee_id = ? AND status = 'missing'", [employeeId]),
    query<{ id: string; name: string }>("SELECT id, name FROM documents WHERE employee_id = ? AND status = 'pending'", [employeeId]),
    query<{ id: string; course: string; provider: string | null }>("SELECT id, course, provider FROM trainings WHERE employee_id = ? AND cert_status = 'expiring'", [employeeId]),
    query<{ id: string; document_id: string | null; training_id: string | null; kind: string }>('SELECT id, document_id, training_id, kind FROM notifications WHERE employee_id = ?', [employeeId]),
  ]);
  const employee = employeeRows[0];
  if (!employee) return; // employee no longer exists — its notifications cascade-deleted already

  const missingDocIds = new Set(missingDocs.map((d) => d.id));
  const pendingDocIds = new Set(pendingDocs.map((d) => d.id));
  const expiringTrainingIds = new Set(expiringTrainings.map((t) => t.id));

  // Clear notifications for issues that are no longer true (doc got uploaded, etc.)
  for (const n of existing) {
    const stillOpen =
      (n.kind === 'missing_document' && n.document_id !== null && missingDocIds.has(n.document_id)) ||
      (n.kind === 'pending_document' && n.document_id !== null && pendingDocIds.has(n.document_id)) ||
      (n.kind === 'expiring_training' && n.training_id !== null && expiringTrainingIds.has(n.training_id));
    if (!stillOpen) await execute('DELETE FROM notifications WHERE id = ?', [n.id]);
  }

  const existingDocIds = new Set(existing.filter((n) => n.kind === 'missing_document').map((n) => n.document_id));
  const existingPendingDocIds = new Set(existing.filter((n) => n.kind === 'pending_document').map((n) => n.document_id));
  const existingTrainingIds = new Set(existing.filter((n) => n.kind === 'expiring_training').map((n) => n.training_id));

  for (const doc of missingDocs) {
    if (existingDocIds.has(doc.id)) continue;
    await execute(
      'INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)',
      [
        `n-${randomUUID()}`, employeeId, doc.id, 'missing_document',
        `${doc.name} missing`, `${employee.display_name} (#${employee.employee_number}) still needs to submit this document.`, 'unread',
      ]
    );
  }
  for (const doc of pendingDocs) {
    if (existingPendingDocIds.has(doc.id)) continue;
    await execute(
      'INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)',
      [
        `n-${randomUUID()}`, employeeId, doc.id, 'pending_document',
        `${doc.name} awaiting review`, `${employee.display_name} (#${employee.employee_number}) submitted this document — review and approve or reject it.`, 'unread',
      ]
    );
  }
  for (const t of expiringTrainings) {
    if (existingTrainingIds.has(t.id)) continue;
    await execute(
      'INSERT INTO notifications (id, employee_id, training_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)',
      [
        `n-${randomUUID()}`, employeeId, t.id, 'expiring_training',
        `${t.course} certificate expiring soon`, `${employee.display_name} (#${employee.employee_number}) — provided by ${t.provider}.`, 'unread',
      ]
    );
  }
}

export async function listNotifications(): Promise<Notification[]> {
  const rows = await query<NotificationRow>('SELECT * FROM notifications ORDER BY (status = "unread") DESC, created_at DESC LIMIT 200');
  return rows.map(mapNotificationRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  await execute("UPDATE notifications SET status = 'read' WHERE id = ?", [id]);
}

export async function markAllNotificationsRead(): Promise<void> {
  await execute("UPDATE notifications SET status = 'read' WHERE status = 'unread'");
}
