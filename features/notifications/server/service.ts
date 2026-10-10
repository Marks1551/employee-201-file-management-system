import { randomUUID } from "crypto";
import { query, execute } from "@/shared/server/db";
import { fmt } from "@/shared/server/format";
import type { Notification, NotificationRow } from "@/shared/types";

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

/** Deleted notifications are kept as `dismissed` (hidden from the list) instead of
 *  being erased, so the automatic sync doesn't immediately re-create an alert for an
 *  issue that is still open. Older databases get the new status value added once,
 *  automatically, the first time notifications are touched. */
let dismissedStatusReady: Promise<void> | null = null;
function ensureDismissedStatus(): Promise<void> {
  if (!dismissedStatusReady) {
    dismissedStatusReady = (async () => {
      try {
        const rows = await query<{ COLUMN_TYPE: string }>(
          "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'status'",
        );
        if (rows[0] && !String(rows[0].COLUMN_TYPE).includes("dismissed")) {
          await execute(
            "ALTER TABLE notifications MODIFY COLUMN status ENUM('unread','read','dismissed') NOT NULL DEFAULT 'unread'",
          );
        }
      } catch (err) {
        console.error("ensureDismissedStatus failed:", err);
        dismissedStatusReady = null; // try again next time
      }
    })();
  }
  return dismissedStatusReady;
}

/** The `pds_updated` kind (faculty edited their PDS) is added to older databases once,
 *  automatically, the first time notifications are touched. */
let pdsKindReady: Promise<void> | null = null;
function ensurePdsKind(): Promise<void> {
  if (!pdsKindReady) {
    pdsKindReady = (async () => {
      try {
        const rows = await query<{ COLUMN_TYPE: string }>(
          "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'notifications' AND COLUMN_NAME = 'kind'",
        );
        if (rows[0] && !String(rows[0].COLUMN_TYPE).includes("pds_updated")) {
          await execute(
            "ALTER TABLE notifications MODIFY COLUMN kind ENUM('missing_document','expiring_training','pending_document','pds_updated') NOT NULL",
          );
        }
      } catch (err) {
        console.error("ensurePdsKind failed:", err);
        pdsKindReady = null; // try again next time
      }
    })();
  }
  return pdsKindReady;
}

async function ensureNotificationSchema(): Promise<void> {
  await ensureDismissedStatus();
  await ensurePdsKind();
}

/**
 * Notifications are a persisted entity (not computed on the fly). Whenever a
 * document or training's status changes, this reconciles the notifications
 * table so there's exactly one open notification per outstanding issue —
 * creating new ones, and clearing ones that are no longer relevant. Called
 * from the employees feature after any document/training mutation.
 */
export async function syncNotificationsForEmployee(employeeId: string): Promise<void> {
  await ensureNotificationSchema();
  const [employeeRows, missingDocs, pendingDocs, expiringTrainings, existing] = await Promise.all([
    query<{ display_name: string; employee_number: string }>(
      "SELECT display_name, employee_number FROM employees WHERE id = ?",
      [employeeId],
    ),
    query<{ id: string; name: string }>("SELECT id, name FROM documents WHERE employee_id = ? AND status = 'missing'", [
      employeeId,
    ]),
    query<{ id: string; name: string }>("SELECT id, name FROM documents WHERE employee_id = ? AND status = 'pending'", [
      employeeId,
    ]),
    query<{ id: string; course: string; provider: string | null }>(
      "SELECT id, course, provider FROM trainings WHERE employee_id = ? AND cert_status = 'expiring'",
      [employeeId],
    ),
    query<{ id: string; document_id: string | null; training_id: string | null; kind: string }>(
      "SELECT id, document_id, training_id, kind FROM notifications WHERE employee_id = ?",
      [employeeId],
    ),
  ]);
  const employee = employeeRows[0];
  if (!employee) return; // employee no longer exists — its notifications cascade-deleted already

  const missingDocIds = new Set(missingDocs.map((d) => d.id));
  const pendingDocIds = new Set(pendingDocs.map((d) => d.id));
  const expiringTrainingIds = new Set(expiringTrainings.map((t) => t.id));

  // Clear notifications for issues that are no longer true (doc got uploaded, etc.)
  for (const n of existing) {
    const stillOpen =
      (n.kind === "missing_document" && n.document_id !== null && missingDocIds.has(n.document_id)) ||
      (n.kind === "pending_document" && n.document_id !== null && pendingDocIds.has(n.document_id)) ||
      (n.kind === "expiring_training" && n.training_id !== null && expiringTrainingIds.has(n.training_id)) ||
      n.kind === "pds_updated"; // stays until HR reads or deletes it
    if (!stillOpen) await execute("DELETE FROM notifications WHERE id = ?", [n.id]);
  }

  const existingDocIds = new Set(existing.filter((n) => n.kind === "missing_document").map((n) => n.document_id));
  const existingPendingDocIds = new Set(
    existing.filter((n) => n.kind === "pending_document").map((n) => n.document_id),
  );
  const existingTrainingIds = new Set(existing.filter((n) => n.kind === "expiring_training").map((n) => n.training_id));

  for (const doc of missingDocs) {
    if (existingDocIds.has(doc.id)) continue;
    await execute(
      "INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)",
      [
        `n-${randomUUID()}`,
        employeeId,
        doc.id,
        "missing_document",
        `${doc.name} missing`,
        `${employee.display_name} (#${employee.employee_number}) still needs to submit this document.`,
        "unread",
      ],
    );
  }
  for (const doc of pendingDocs) {
    if (existingPendingDocIds.has(doc.id)) continue;
    await execute(
      "INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)",
      [
        `n-${randomUUID()}`,
        employeeId,
        doc.id,
        "pending_document",
        `${doc.name} awaiting review`,
        `${employee.display_name} (#${employee.employee_number}) submitted this document — review and approve or reject it.`,
        "unread",
      ],
    );
  }
  for (const t of expiringTrainings) {
    if (existingTrainingIds.has(t.id)) continue;
    await execute(
      "INSERT INTO notifications (id, employee_id, training_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)",
      [
        `n-${randomUUID()}`,
        employeeId,
        t.id,
        "expiring_training",
        `${t.course} certificate expiring soon`,
        `${employee.display_name} (#${employee.employee_number}) — provided by ${t.provider}.`,
        "unread",
      ],
    );
  }
}

export async function listNotifications(): Promise<Notification[]> {
  await ensureNotificationSchema();
  const rows = await query<NotificationRow>(
    "SELECT * FROM notifications WHERE status <> 'dismissed' ORDER BY (status = 'unread') DESC, created_at DESC LIMIT 200",
  );
  return rows.map(mapNotificationRow);
}

/** One employee's own missing-document / expiring-certificate alerts (including ones HR has
 *  already cleared), so the faculty bell can show when each item first came up. */
export async function listNotificationsForEmployee(employeeId: string): Promise<Notification[]> {
  await ensureNotificationSchema();
  const rows = await query<NotificationRow>(
    "SELECT * FROM notifications WHERE employee_id = ? AND kind IN ('missing_document','expiring_training') ORDER BY created_at DESC LIMIT 200",
    [employeeId],
  );
  return rows.map(mapNotificationRow);
}

export async function markNotificationRead(id: string): Promise<void> {
  await execute("UPDATE notifications SET status = 'read' WHERE id = ?", [id]);
}

export async function markAllNotificationsRead(): Promise<void> {
  await execute("UPDATE notifications SET status = 'read' WHERE status = 'unread'");
}

/** Deletes (hides) one notification. Comes back only if the issue is resolved and later happens again. */
export async function dismissNotification(id: string): Promise<void> {
  await ensureNotificationSchema();
  await execute("UPDATE notifications SET status = 'dismissed' WHERE id = ?", [id]);
}

/** Deletes (hides) every notification currently shown. */
export async function dismissAllNotifications(): Promise<void> {
  await ensureNotificationSchema();
  await execute("UPDATE notifications SET status = 'dismissed' WHERE status <> 'dismissed'");
}

/** A faculty member edited their own PDS: tell HR. There is one `pds_updated`
 *  notification per employee — a new edit re-arms it (back to unread, newest first)
 *  instead of piling up one alert per saved field. */
export async function notifyPdsUpdated(employeeId: string, section: string): Promise<void> {
  await ensureNotificationSchema();
  const employeeRows = await query<{ display_name: string; employee_number: string }>(
    "SELECT display_name, employee_number FROM employees WHERE id = ?",
    [employeeId],
  );
  const employee = employeeRows[0];
  if (!employee) return;

  const title = `${employee.display_name} updated their PDS`;
  const detail = `${employee.display_name} (#${employee.employee_number}) edited their Personal Data Sheet — ${section}. Open the record to review the changes.`;

  const existing = await query<{ id: string }>(
    "SELECT id FROM notifications WHERE employee_id = ? AND kind = 'pds_updated' LIMIT 1",
    [employeeId],
  );
  if (existing[0]) {
    await execute(
      "UPDATE notifications SET status = 'unread', title = ?, detail = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?",
      [title, detail, existing[0].id],
    );
  } else {
    await execute("INSERT INTO notifications (id, employee_id, kind, title, detail, status) VALUES (?,?,?,?,?,?)", [
      `n-${randomUUID()}`,
      employeeId,
      "pds_updated",
      title,
      detail,
      "unread",
    ]);
  }
}

/** Notifies HR only when the person who made the change is faculty (HR/admin edits don't alert anyone). */
export async function notifyPdsUpdatedBy(user: { role: string }, employeeId: string, section: string): Promise<void> {
  if (user.role === "faculty") await notifyPdsUpdated(employeeId, section);
}
