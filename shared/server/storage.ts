// Thin wrapper around Firebase Storage (via the Firebase Admin SDK).
// Used instead of the local filesystem for uploaded documents, employee photos
// and chat attachments: serverless hosts run functions on a read-only
// filesystem, so files have to live in object storage.
//
// Same interface the old Cloudflare R2 module had, so callers only changed their import path.
//
// Required environment variables (from Firebase console → Project settings → Service accounts
// → "Generate new private key", plus your Storage bucket name):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY        (keep the \n escapes if you put it on one line)
//   FIREBASE_STORAGE_BUCKET     (e.g. your-project.firebasestorage.app)

import { randomUUID } from "crypto";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";

const bucketName = process.env.FIREBASE_STORAGE_BUCKET;

let app: App | null = null;

function getApp(): App {
  if (!app) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Firebase storage is not configured — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
      );
    }
    app =
      getApps()[0] ||
      initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), storageBucket: bucketName });
  }
  return app;
}

function requireBucketName(): string {
  if (!bucketName) throw new Error("Firebase storage is not configured — set FIREBASE_STORAGE_BUCKET.");
  return bucketName;
}

function bucket() {
  return getStorage(getApp()).bucket(requireBucketName());
}

/** Firebase "download URL" for an object: opens in the browser without any extra permissions. */
function downloadUrlFor(key: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${requireBucketName()}/o/${encodeURIComponent(key)}?alt=media&token=${token}`;
}

/** Adds a cache-busting `v` parameter to a stored file URL (which already has a query string). */
export function withCacheBust(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

/** Uploads a file (or raw bytes) at the given key and returns its public download URL. */
export async function putObject(key: string, file: File | Buffer, contentType: string): Promise<string> {
  const bytes = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
  const token = randomUUID();
  await bucket()
    .file(key)
    .save(bytes, {
      resumable: false,
      contentType,
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
  return downloadUrlFor(key, token);
}

/** Reads an object's bytes (used to serve real "save as" downloads). Returns null if it's missing. */
export async function getObjectBytes(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  try {
    const file = bucket().file(key);
    const [[data], [meta]] = await Promise.all([file.download(), file.getMetadata()]);
    return { bytes: data, contentType: (meta.contentType as string) || "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Deletes every object under a key prefix (e.g. all extensions of one base filename). Never throws. */
export async function deleteObjectsWithPrefix(prefix: string): Promise<void> {
  try {
    await bucket().deleteFiles({ prefix, force: true });
  } catch {
    // nothing to clean up, or storage isn't reachable — not fatal for the caller
  }
}

/** Deletes a single object by key. Never throws. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await bucket().file(key).delete({ ignoreNotFound: true });
  } catch {
    // object may already be gone — nothing to do
  }
}

/** Recovers the object key from a previously-returned download URL, or null if it isn't one of ours. */
export function keyFromPublicUrl(url: string): string | null {
  if (!bucketName) return null;
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`;
  if (!url.startsWith(prefix)) return null;
  const encodedKey = url.slice(prefix.length).split("?")[0];
  try {
    return decodeURIComponent(encodedKey) || null;
  } catch {
    return null;
  }
}
