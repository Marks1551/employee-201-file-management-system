// One-time migration: copies every file referenced in the database from Cloudflare R2 to
// Firebase Storage and rewrites the saved links.
//
//   1. Put the Firebase variables in your env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
//      FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET) next to your DB_* variables, and keep
//      R2_PUBLIC_URL set to the OLD public address of your R2 bucket.
//   2. Run:  node --env-file=.env.local db/migrate-r2-to-firebase.mjs
//      (add --dry-run to only list what would be copied)
//
// It is safe to run again: rows that already point at Firebase are skipped, and the old R2 files
// are not deleted — remove them yourself once you've checked everything.

import { randomUUID } from "node:crypto";
import mysql from "mysql2/promise";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const dryRun = process.argv.includes("--dry-run");
const oldBase = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");
if (!oldBase) throw new Error("Set R2_PUBLIC_URL to your old R2 public address.");
for (const k of ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY", "FIREBASE_STORAGE_BUCKET"]) {
  if (!process.env[k]) throw new Error(`Missing ${k}`);
}

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: bucketName,
  });
const bucket = getStorage(app).bucket(bucketName);

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "e201_fms",
});

// table, column that holds the link
const targets = [
  ["employees", "photo_url"],
  ["users", "photo_url"],
  ["documents", "file_url"],
  ["documents", "pending_file_url"],
  ["trainings", "cert_file_url"],
  ["messages", "attachment_url"],
];

const cache = new Map(); // old url (no query) -> new url

async function copyOne(oldUrl) {
  const clean = oldUrl.split("?")[0];
  if (cache.has(clean)) return cache.get(clean);
  const key = decodeURIComponent(clean.slice(oldBase.length + 1));
  const res = await fetch(clean);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const token = randomUUID();
  await bucket.file(key).save(bytes, {
    resumable: false,
    contentType: res.headers.get("content-type") || "application/octet-stream",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(key)}?alt=media&token=${token}`;
  cache.set(clean, url);
  return url;
}

let copied = 0;
let failed = 0;
for (const [table, column] of targets) {
  let rows;
  try {
    [rows] = await db.query(`SELECT id, \`${column}\` AS url FROM \`${table}\` WHERE \`${column}\` LIKE ?`, [`${oldBase}/%`]);
  } catch (err) {
    console.warn(`Skipping ${table}.${column}: ${err.message}`);
    continue;
  }
  for (const row of rows) {
    try {
      if (dryRun) {
        console.log(`[dry run] ${table}.${column} #${row.id}: ${row.url}`);
        continue;
      }
      const newUrl = await copyOne(row.url);
      await db.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE id = ?`, [newUrl, row.id]);
      copied++;
      console.log(`✓ ${table}.${column} #${row.id}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${table}.${column} #${row.id} (${row.url}): ${err.message}`);
    }
  }
}
await db.end();
console.log(dryRun ? "Dry run finished." : `Done. ${copied} link(s) moved, ${failed} failed.`);
