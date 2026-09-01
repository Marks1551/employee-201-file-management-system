import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { requireRole } from '@/shared/server/api-helpers';
import { listEmployees } from '@/features/employees/server/service';
import { listUsers } from '@/features/users/server/service';
import { listAuditLog, addAuditLog } from '@/features/audit-log/server/service';
import { setMeta } from '@/shared/server/meta';
import { roleLabel, nowStamp } from '@/shared/lib/roles';

const execFileAsync = promisify(execFile);
const BACKUP_DIR = path.join(process.cwd(), 'backups');

async function tryMysqldump(fileBase: string): Promise<string> {
  const { DB_HOST = 'localhost', DB_PORT = '3306', DB_USER = 'root', DB_PASSWORD = '', DB_NAME = 'e201_fms' } = process.env;
  const outFile = path.join(BACKUP_DIR, `${fileBase}.sql`);
  const args = ['-h', DB_HOST, '-P', DB_PORT, '-u', DB_USER, DB_NAME];
  if (DB_PASSWORD) args.splice(6, 0, `-p${DB_PASSWORD}`);
  const { stdout } = await execFileAsync('mysqldump', args, { maxBuffer: 1024 * 1024 * 64 });
  await fs.writeFile(outFile, stdout, 'utf8');
  return outFile;
}

async function jsonFallback(fileBase: string): Promise<string> {
  const outFile = path.join(BACKUP_DIR, `${fileBase}.json`);
  const [employees, users, auditLog] = await Promise.all([listEmployees(), listUsers(), listAuditLog()]);
  await fs.writeFile(outFile, JSON.stringify({ employees, users, auditLog, backedUpAt: new Date().toISOString() }, null, 2), 'utf8');
  return outFile;
}

export async function POST() {
  const user = await requireRole('admin');
  if (user instanceof NextResponse) return user;

  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const fileBase = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  let file: string;
  let method = 'mysqldump';
  try {
    file = await tryMysqldump(fileBase);
  } catch {
    // mysqldump isn't installed/reachable on this host — fall back to a JSON export
    // of everything a backup should cover, so the action stays functional.
    method = 'json-export';
    file = await jsonFallback(fileBase);
  }

  const stamp = nowStamp();
  await setMeta('lastBackup', stamp);
  await addAuditLog(user.name, roleLabel(user.role), 'Started a full database backup');

  return NextResponse.json({ stamp, file: path.basename(file), method });
}
