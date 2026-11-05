import { query, execute } from "@/shared/server/db";

/** The expires_on / pending_expires_on columns on `documents` were added after the first
 *  release. Existing databases get them automatically, once, the first time they're needed. */
let ready: Promise<void> | null = null;
export function ensureDocumentExpiryColumns(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      try {
        const rows = await query<{ COLUMN_NAME: string }>(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME IN ('expires_on','pending_expires_on')",
        );
        const have = new Set(rows.map((r) => r.COLUMN_NAME));
        if (!have.has("expires_on")) await execute("ALTER TABLE documents ADD COLUMN expires_on VARCHAR(60) NULL");
        if (!have.has("pending_expires_on"))
          await execute("ALTER TABLE documents ADD COLUMN pending_expires_on VARCHAR(60) NULL");
      } catch (err) {
        console.error("ensureDocumentExpiryColumns failed:", err);
        ready = null; // try again on the next request
      }
    })();
  }
  return ready;
}
