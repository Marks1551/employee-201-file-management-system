import { randomUUID } from "crypto";
import { query, execute } from "@/shared/server/db";
import { fmt } from "@/shared/server/format";

export interface Announcement {
  id: string;
  title: string;
  body: string;
  /** "all" or a department name */
  audience: string;
  createdBy: string;
  when: string | null;
  createdAt: string;
}

interface AnnouncementRow {
  id: string;
  title: string;
  body: string;
  audience: string;
  created_by: string | null;
  created_at: string;
}

// Created automatically the first time it's needed, so no manual SQL step is required.
let tableReady: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = execute(
      `CREATE TABLE IF NOT EXISTS announcements (
         id          VARCHAR(64)  PRIMARY KEY,
         title       VARCHAR(200) NOT NULL,
         body        TEXT NOT NULL,
         audience    VARCHAR(150) NOT NULL DEFAULT 'all',
         created_by  VARCHAR(150),
         created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         INDEX idx_announcements_created (created_at)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

function map(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    audience: row.audience,
    createdBy: row.created_by || "HR",
    when: fmt(row.created_at),
    createdAt: String(row.created_at),
  };
}

/** HR/admin see everything; an employee sees announcements for everyone plus their own department. */
export async function listAnnouncements(department?: string | null): Promise<Announcement[]> {
  await ensureTable();
  const rows = department
    ? await query<AnnouncementRow>(
        "SELECT * FROM announcements WHERE audience = 'all' OR audience = ? ORDER BY created_at DESC LIMIT 100",
        [department],
      )
    : await query<AnnouncementRow>("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 100");
  return rows.map(map);
}

export async function createAnnouncement(data: {
  title: string;
  body: string;
  audience: string;
  createdBy: string;
}): Promise<Announcement> {
  await ensureTable();
  const id = `ann-${randomUUID()}`;
  await execute("INSERT INTO announcements (id, title, body, audience, created_by) VALUES (?,?,?,?,?)", [
    id,
    data.title,
    data.body,
    data.audience,
    data.createdBy,
  ]);
  const rows = await query<AnnouncementRow>("SELECT * FROM announcements WHERE id = ?", [id]);
  return map(rows[0]);
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  await ensureTable();
  const rows = await query<AnnouncementRow>("SELECT id FROM announcements WHERE id = ?", [id]);
  if (!rows.length) return false;
  await execute("DELETE FROM announcements WHERE id = ?", [id]);
  return true;
}

/** The department of the employee linked to a login account (null if none). */
export async function departmentForEmployee(employeeId: string | null | undefined): Promise<string | null> {
  if (!employeeId) return null;
  const rows = await query<{ department: string }>("SELECT department FROM employees WHERE id = ?", [employeeId]);
  return rows[0]?.department || null;
}
