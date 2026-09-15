import { NextResponse } from "next/server";
import { putObject, deleteObject, deleteObjectsWithPrefix, keyFromPublicUrl } from "@/shared/server/r2";
import { getSessionUserId } from "@/features/auth/server/session";
import { getUserPublic } from "@/features/users/server/service";
import type { StoredFile, User } from "@/shared/types";

const ALLOWED_DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB

export type SaveDocumentFileResult = { url: string; name: string; type: string; error?: undefined } | { error: string };

/** Validates and uploads a document file to Cloudflare R2 under
 *  documents/{subDir}/{baseName}.{ext}, removing any previous object with
 *  that base name first (it may have a different extension than the new
 *  file). Returns { url, name, type } on success or { error } on failure —
 *  never throws for expected validation issues. */
export async function saveDocumentFile(
  file: File | string | null | undefined,
  subDir: string,
  baseName: string,
): Promise<SaveDocumentFileResult> {
  if (!file || typeof file === "string") {
    return { error: "No file was provided." };
  }
  const ext = ALLOWED_DOC_TYPES[file.type];
  if (!ext) {
    return { error: "Please upload a PDF, JPG, PNG, or WEBP file." };
  }
  if (file.size > MAX_DOC_SIZE) {
    return { error: "File must be smaller than 5MB." };
  }

  const prefix = `documents/${subDir}/${baseName}.`;
  await deleteObjectsWithPrefix(prefix);

  const key = `${prefix}${ext}`;
  const url = await putObject(key, file, file.type);

  return { url: `${url}?v=${Date.now()}`, name: file.name || key, type: file.type };
}

/** Best-effort delete of a previously stored document object. Never throws. */
export async function deleteDocumentFile(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  const key = keyFromPublicUrl(fileUrl.split("?")[0]);
  if (key) await deleteObject(key);
}

/** Returns the logged-in user (public shape, no password) or null. */
export async function getCurrentUser(): Promise<User | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return getUserPublic(userId);
}

/** Use inside a route handler: `const user = await requireUser(); if (user instanceof NextResponse) return user;` */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  return user;
}

export async function requireRole(...roles: string[]): Promise<User | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: "You do not have permission to do that." }, { status: 403 });
  }
  return user;
}

export type { StoredFile };
