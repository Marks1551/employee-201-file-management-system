import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/shared/server/api-helpers";
import { getObjectBytes, keyFromPublicUrl } from "@/shared/server/r2";

/** Streams an uploaded file back as a real download ("Save as…") instead of opening it in the
 *  browser. Browsers ignore the <a download> attribute for files on another origin (our storage
 *  bucket), so the Download links point here instead.
 *  GET /api/files/download?url=<stored file url>&name=<file name to save as> */
export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const url = request.nextUrl.searchParams.get("url") || "";
  const name = request.nextUrl.searchParams.get("name") || "";

  // Only files in our own storage bucket can be fetched — this is not a general proxy.
  const key = keyFromPublicUrl(url.split("?")[0]);
  if (!key) return NextResponse.json({ error: "Unknown file." }, { status: 400 });

  const file = await getObjectBytes(key);
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
