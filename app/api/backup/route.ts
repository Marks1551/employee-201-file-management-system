import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireRole } from "@/shared/server/api-helpers";
import { listEmployees } from "@/features/employees/server/service";
import { listUsers } from "@/features/users/server/service";
import { listAuditLog, addAuditLog } from "@/features/audit-log/server/service";
import { setMeta } from "@/shared/server/meta";
import { roleLabel, nowStamp } from "@/shared/lib/roles";

const execFileAsync = promisify(execFile);

async function tryMysqldump(): Promise<string> {
  const {
    DB_HOST = "localhost",
    DB_PORT = "3306",
    DB_USER = "root",
    DB_PASSWORD = "",
    DB_NAME = "e201_fms",
  } = process.env;
  const args = ["-h", DB_HOST, "-P", DB_PORT, "-u", DB_USER, DB_NAME];
  if (DB_PASSWORD) args.splice(6, 0, `-p${DB_PASSWORD}`);
  const { stdout } = await execFileAsync("mysqldump", args, { maxBuffer: 1024 * 1024 * 64 });
  return stdout;
}

async function jsonFallback(): Promise<string> {
  const [employees, users, auditLog] = await Promise.all([listEmployees(), listUsers(), listAuditLog()]);
  return JSON.stringify({ employees, users, auditLog, backedUpAt: new Date().toISOString() }, null, 2);
}

export async function POST() {
  const user = await requireRole("admin");
  if (user instanceof NextResponse) return user;

  const timestampForFilename = new Date().toISOString().replace(/[:.]/g, "-");

  let content: string;
  let method = "mysqldump";
  let extension = "sql";
  let contentType = "application/sql";
  try {
    content = await tryMysqldump();
  } catch {
    // mysqldump isn't installed/reachable on this host — fall back to a JSON export
    // of everything a backup should cover, so the action stays functional.
    method = "json-export";
    extension = "json";
    contentType = "application/json";
    content = await jsonFallback();
  }

  const stamp = nowStamp();
  await setMeta("lastBackup", stamp);
  await addAuditLog(user.name, roleLabel(user.role), "Started a full database backup");

  // Stream the dump straight back to the browser as a download instead of
  // writing it to disk on the server: Railway's filesystem is ephemeral and
  // wipes any local `backups/` folder on the next redeploy, so a file saved
  // server-side would never actually be retrievable.
  const filename = `backup-${timestampForFilename}.${extension}`;
  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Backup-Stamp": stamp,
      "X-Backup-Method": method,
    },
  });
}
