import { randomUUID } from "crypto";
import { query, execute } from "@/shared/server/db";
import { DEPARTMENTS } from "@/shared/lib/roles";

/** Departments/colleges HR has added on top of the built-in DEPARTMENTS list (e.g. when the
 *  school opens a new course), plus built-in ones HR has removed. Stored in their own tables,
 *  created automatically the first time they're needed — no manual migration required. */
let tablesReady: Promise<void> | null = null;
function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await execute(
        `CREATE TABLE IF NOT EXISTS departments (
           id          VARCHAR(64)  PRIMARY KEY,
           name        VARCHAR(120) NOT NULL UNIQUE,
           created_by  VARCHAR(150),
           created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
      // Built-in departments HR has chosen to remove.
      await execute(
        `CREATE TABLE IF NOT EXISTS removed_departments (
           name        VARCHAR(120) PRIMARY KEY,
           removed_by  VARCHAR(150),
           removed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    })().catch((err) => {
      tablesReady = null; // try again on the next request
      throw err;
    });
  }
  return tablesReady;
}

const isBuiltIn = (name: string) => DEPARTMENTS.some((d) => d.toLowerCase() === name.toLowerCase());

/** Built-in departments (minus removed ones) followed by the ones HR added, without
 *  case-insensitive duplicates. */
async function visibleNames(): Promise<string[]> {
  await ensureTables();
  const [custom, removed] = await Promise.all([
    query<{ name: string }>("SELECT name FROM departments ORDER BY created_at ASC, name ASC"),
    query<{ name: string }>("SELECT name FROM removed_departments"),
  ]);
  const removedKeys = new Set(removed.map((r) => r.name.toLowerCase()));
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of [...DEPARTMENTS.filter((d) => !removedKeys.has(d.toLowerCase())), ...custom.map((r) => r.name)]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}

export async function listDepartments(): Promise<string[]> {
  return visibleNames();
}

export interface DepartmentInfo {
  name: string;
  employeeCount: number;
}

/** Every department with how many employees currently belong to it. */
export async function listDepartmentDetails(): Promise<DepartmentInfo[]> {
  const names = await visibleNames();
  const rows = await query<{ department: string | null; c: number }>(
    "SELECT department, COUNT(*) AS c FROM employees GROUP BY department",
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.department) continue;
    const key = r.department.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + Number(r.c));
  }
  return names.map((name) => ({ name, employeeCount: counts.get(name.toLowerCase()) || 0 }));
}

export type DepartmentResult = { ok: true; name: string } | { ok: false; error: string; status: number };

export async function addDepartment(rawName: string, createdBy: string): Promise<DepartmentResult> {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, error: "Department name is required.", status: 400 };
  if (name.length > 120) return { ok: false, error: "Department name is too long (120 characters max).", status: 400 };

  const existing = await visibleNames();
  if (existing.some((d) => d.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: "That department already exists.", status: 409 };
  }

  // Re-adding a built-in department that was removed just restores it.
  const removed = await query<{ name: string }>("SELECT name FROM removed_departments WHERE LOWER(name) = LOWER(?)", [
    name,
  ]);
  if (removed.length > 0) {
    await execute("DELETE FROM removed_departments WHERE LOWER(name) = LOWER(?)", [name]);
    return { ok: true, name: DEPARTMENTS.find((d) => d.toLowerCase() === name.toLowerCase()) ?? name };
  }

  await execute("INSERT INTO departments (id, name, created_by) VALUES (?,?,?)", [
    `dept-${randomUUID()}`,
    name,
    createdBy,
  ]);
  return { ok: true, name };
}

/** Removes a department. Refused while any employee still belongs to it, so no record is left
 *  pointing at a department that no longer exists. */
export async function removeDepartment(rawName: string, removedBy: string): Promise<DepartmentResult> {
  const wanted = rawName.trim().toLowerCase();
  const match = (await visibleNames()).find((d) => d.toLowerCase() === wanted);
  if (!match) return { ok: false, error: "Department not found.", status: 404 };

  const rows = await query<{ c: number }>("SELECT COUNT(*) AS c FROM employees WHERE LOWER(department) = LOWER(?)", [
    match,
  ]);
  const count = Number(rows[0]?.c || 0);
  if (count > 0) {
    return {
      ok: false,
      error: `${count} employee${count === 1 ? " is" : "s are"} still in this department. Reassign them first.`,
      status: 409,
    };
  }

  await execute("DELETE FROM departments WHERE LOWER(name) = LOWER(?)", [match]);
  if (isBuiltIn(match)) {
    await execute("INSERT IGNORE INTO removed_departments (name, removed_by) VALUES (?,?)", [match, removedBy]);
  }
  return { ok: true, name: match };
}
