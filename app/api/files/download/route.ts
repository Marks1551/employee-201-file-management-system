import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/shared/server/api-helpers";
import { readFile } from "fs/promises";
import path from "path";
import { getObjectBytes, keyFromPublicUrl } from "@/shared/server/storage";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

/** Reads a bundled sample file (e.g. /assets/documents/emp-0142-id.png) from /public. Only
 *  paths under /assets/ are allowed, and anything escaping that folder is rejected. */
async function readPublicAsset(urlPath: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!urlPath.startsWith("/assets/")) return null;
  const assetsDir = path.join(PUBLIC_DIR, "assets");
  const full = path.join(PUBLIC_DIR, path.normalize(decodeURIComponent(urlPath)));
  if (!full.startsWith(assetsDir + path.sep)) return null;
  try {
    const bytes = await readFile(full);
    return { bytes, contentType: MIME[path.extname(full).toLowerCase()] || "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Streams an uploaded file back as a real download ("Save as…") instead of opening it in the
 *  browser. Browsers ignore the <a download> attribute for files on another origin (our storage
 *  bucket), so the Download links point here instead.
 *  GET /api/files/download?url=<stored file url>&name=<file name to save as> */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const url = request.nextUrl.searchParams.get("url") || "";
  const name = request.nextUrl.searchParams.get("name") || "";

  // Only our own files can be fetched (storage bucket or bundled /assets samples) — this is not a general proxy.
  const cleanUrl = url.split("?")[0];
  const key = cleanUrl.startsWith("/") ? cleanUrl : keyFromPublicUrl(cleanUrl);
  if (!key) return NextResponse.json({ error: "Unknown file." }, { status: 400 });

  const file = cleanUrl.startsWith("/") ? await readPublicAsset(cleanUrl) : await getObjectBytes(key);
  if (!file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const fallback = key.split("/").pop() || "download";
  const filename = (name || fallback).replace(/[\r\n"\\/]/g, "_");
  return new NextResponse(Buffer.from(file.bytes), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
