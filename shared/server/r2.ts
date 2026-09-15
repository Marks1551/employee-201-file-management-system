// Thin wrapper around the S3-compatible API that Cloudflare R2 exposes.
// Used instead of the local filesystem for uploaded documents and employee
// photos: serverless hosts like Vercel run functions on a read-only
// filesystem (aside from /tmp, which is wiped between invocations and isn't
// shared across instances), so writes to public/ work in local dev but
// silently fail, or don't persist, once deployed.

import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucketName = process.env.R2_BUCKET_NAME;
const publicUrl = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error("R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
    }
    client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return client;
}

function requireBucket(): string {
  if (!bucketName) throw new Error("R2 storage is not configured — set R2_BUCKET_NAME.");
  return bucketName;
}

function publicUrlFor(key: string): string {
  if (!publicUrl) throw new Error("R2 storage is not configured — set R2_PUBLIC_URL.");
  return `${publicUrl}/${key}`;
}

/** Uploads a file (or raw bytes) to R2 at the given key and returns its public URL. */
export async function putObject(key: string, file: File | Buffer, contentType: string): Promise<string> {
  const bytes = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
  await getClient().send(
    new PutObjectCommand({ Bucket: requireBucket(), Key: key, Body: bytes, ContentType: contentType }),
  );
  return publicUrlFor(key);
}

/** Deletes every object under a key prefix (e.g. all extensions of one base filename). Never throws. */
export async function deleteObjectsWithPrefix(prefix: string): Promise<void> {
  try {
    const res = await getClient().send(new ListObjectsV2Command({ Bucket: requireBucket(), Prefix: prefix }));
    const keys = (res.Contents || []).map((o) => o.Key).filter((k): k is string => !!k);
    await Promise.all(
      keys.map((k) =>
        getClient()
          .send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: k }))
          .catch(() => {}),
      ),
    );
  } catch {
    // nothing to clean up, or storage isn't reachable — not fatal for the caller
  }
}

/** Deletes a single object by key. Never throws. */
export async function deleteObject(key: string): Promise<void> {
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: requireBucket(), Key: key }));
  } catch {
    // object may already be gone — nothing to do
  }
}

/** Recovers the R2 object key from a previously-returned public URL, or null if it doesn't match. */
export function keyFromPublicUrl(url: string): string | null {
  if (!publicUrl || !url.startsWith(`${publicUrl}/`)) return null;
  return url.slice(publicUrl.length + 1);
}
