// Adds any missing required document rows (Medical Certificate, License, PRC, ...)
// to EXISTING employees, marked as "missing", plus the matching HR notifications.
// Safe to re-run — it only inserts rows that don't exist yet. Does NOT wipe data.
//
// Usage: npm run db:backfill-docs
// Reads DB connection settings from .env.local (or .env), same as db:seed.

import fs from 'fs';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';

if (fs.existsSync('.env.local')) dotenv.config({ path: '.env.local' });
else dotenv.config();

// Keep in sync with DEFAULT_DOC_TYPES in features/employees/server/service.ts
const REQUIRED = ['Government-Issued ID', 'Diploma / Transcript of Records', 'NBI Clearance', 'Employment Contract', 'Medical Certificate', 'License', 'PRC'];

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'e201_fms',
});

const [employees] = await conn.query('SELECT id, display_name, employee_number FROM employees');
let added = 0;
for (const emp of employees) {
  const [rows] = await conn.query('SELECT name FROM documents WHERE employee_id = ?', [emp.id]);
  const have = new Set(rows.map((r) => r.name));
  for (const name of REQUIRED) {
    if (have.has(name)) continue;
    const docId = `d-${randomUUID()}`;
    await conn.execute('INSERT INTO documents (id, employee_id, name, status, uploaded_at) VALUES (?,?,?,?,?)', [docId, emp.id, name, 'missing', null]);
    await conn.execute(
      'INSERT INTO notifications (id, employee_id, document_id, kind, title, detail, status) VALUES (?,?,?,?,?,?,?)',
      [`n-${randomUUID()}`, emp.id, docId, 'missing_document', `${name} missing`, `${emp.display_name} (#${emp.employee_number}) still needs to submit this document.`, 'unread']
    );
    added++;
  }
}
console.log(`Done. Added ${added} missing-document row(s) across ${employees.length} employee(s).`);
await conn.end();
