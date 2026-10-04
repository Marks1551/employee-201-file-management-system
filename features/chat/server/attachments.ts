// Validation + storage for files sent in chat (photos and documents).
// Files go to the same Cloudflare R2 bucket as the rest of the app's uploads, under
// chat/{random-uuid}/{safe-file-name} — the random folder makes the URL unguessable.
import { randomUUID } from "crypto";
import { putObject } from "@/shared/server/r2";

export const MAX_ATTACHMENT_SIZE = 5 * 1024 * 1024; // 5MB, same limit as 201-file documents

/** Allowed extensions -> the content type we store/serve them with. We deliberately do NOT trust
 *  the browser-supplied file.type, and we leave out anything that can run in a browser (html, svg, js). */
const ALLOWED_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};

export const ALLOWED_ATTACHMENT_LABEL = "photos (JPG, PNG, WEBP, GIF), PDF, Word, Excel, PowerPoint, TXT or CSV";

export interface SavedAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

function startsWith(bytes: Buffer, sig: number[], offset = 0): boolean {
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** Checks that the file's first bytes really match its extension (a renamed .exe won't pass as .jpg). */
function contentMatchesExtension(ext: string, bytes: Buffer): boolean {
  switch (ext) {
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]);
    case "gif":
      return startsWith(bytes, [0x47, 0x49, 0x46, 0x38]);
    case "webp":
      return startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46]);
    case "docx":
    case "xlsx":
    case "pptx":
      return startsWith(bytes, [0x50, 0x4b]); // zip container
    case "doc":
    case "xls":
    case "ppt":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]); // legacy OLE container
    default:
      return !bytes.subarray(0, 1024).includes(0); // txt/csv: plain text only (no binary)
  }
}

function cleanDisplayName(name: string): string {
  const base = name.split(/[\\/]/).pop() || "file";
  // eslint-disable-next-line no-control-regex
  return (
    base
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 120) || "file"
  );
}

export async function saveChatAttachment(file: File): Promise<SavedAttachment | { error: string }> {
  const displayName = cleanDisplayName(file.name || "file");
  const ext = (displayName.split(".").pop() || "").toLowerCase();
  const contentType = ALLOWED_TYPES[ext];
  if (!contentType || !displayName.includes(".")) {
    return { error: `That file type isn't allowed. You can send ${ALLOWED_ATTACHMENT_LABEL}.` };
  }
  if (file.size === 0) return { error: "That file is empty." };
  if (file.size > MAX_ATTACHMENT_SIZE) return { error: "File must be smaller than 5MB." };

  const bytes = Buffer.from(await file.arrayBuffer());
  if (!contentMatchesExtension(ext, bytes)) {
    return { error: `That file doesn't look like a real .${ext} file.` };
  }

  // Only URL-safe characters in the stored key so the link always works and downloads with a readable name.
  const safeName = displayName.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "") || `file.${ext}`;
  const key = `chat/${randomUUID()}/${safeName}`;
  const url = await putObject(key, bytes, contentType);
  return { url, name: displayName, type: contentType, size: bytes.length };
}
