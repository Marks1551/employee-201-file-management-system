import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSessionUserId } from '@/features/auth/server/session';
import { getUserPublic } from '@/features/users/server/service';
import type { StoredFile, User } from '@/shared/types';

const ALLOWED_DOC_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB

export type SaveDocumentFileResult = { url: string; name: string; type: string; error?: undefined } | { error: string };

/** Validates and writes an uploaded document file to
 *  public/uploads/documents/{subDir}/{baseName}.{ext}, removing any previous
 *  file with that base name first. Returns { url, name, type } on success or
 *  { error } on failure — never throws for expected validation issues. */
export async function saveDocumentFile(
  file: File | string | null | undefined,
  subDir: string,
  baseName: string
): Promise<SaveDocumentFileResult> {
  if (!file || typeof file === 'string') {
    return { error: 'No file was provided.' };
  }
  const ext = ALLOWED_DOC_TYPES[file.type];
  if (!ext) {
    return { error: 'Please upload a PDF, JPG, PNG, or WEBP file.' };
  }
  if (file.size > MAX_DOC_SIZE) {
    return { error: 'File must be smaller than 5MB.' };
  }

  const dir = path.join(process.cwd(), 'public', 'uploads', 'documents', subDir);
  await fs.mkdir(dir, { recursive: true });

  let existing: string[] = [];
  try {
    existing = await fs.readdir(dir);
  } catch {
    existing = [];
  }
  await Promise.all(
    existing.filter((f) => f.startsWith(`${baseName}.`)).map((f) => fs.unlink(path.join(dir, f)).catch(() => {}))
  );

  const filename = `${baseName}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), bytes);

  return { url: `/uploads/documents/${subDir}/${filename}?v=${Date.now()}`, name: file.name || filename, type: file.type };
}

/** Best-effort delete of a previously stored document file. Never throws. */
export async function deleteDocumentFile(fileUrl: string | null | undefined): Promise<void> {
  if (!fileUrl) return;
  try {
    const clean = fileUrl.split('?')[0];
    await fs.unlink(path.join(process.cwd(), 'public', clean));
  } catch {
    // file may already be gone — nothing to do
  }
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
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  return user;
}

export async function requireRole(...roles: string[]): Promise<User | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  if (!roles.includes(user.role)) {
    return NextResponse.json({ error: 'You do not have permission to do that.' }, { status: 403 });
  }
  return user;
}

export type { StoredFile };
