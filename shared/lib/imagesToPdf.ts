// Merges several photos / scans (JPG, PNG, WEBP) into ONE PDF, entirely in the browser, so a
// multi-page document can be submitted as the single file the system stores per document.
// Each image becomes one page (A4, portrait or landscape to match the image), in the given order.
// Images are re-encoded as JPEG and capped in size to keep the PDF under the upload limit.

const A4_W = 595.28; // points
const A4_H = 841.89;
const MAX_EDGE = 2000; // px — plenty for a readable scan, keeps the file small
const JPEG_QUALITY = 0.85;

type Page = { jpeg: Uint8Array; w: number; h: number };

async function toPage(file: File): Promise<Page> {
  const bmp = await createImageBitmap(file); // honours EXIF rotation from phone cameras
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available.");
  ctx.fillStyle = "#fff"; // JPEG has no transparency (PNG scans)
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", JPEG_QUALITY));
  if (!blob) throw new Error(`Could not read "${file.name}".`);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), w, h };
}

export async function imagesToPdf(files: File[], name = "document.pdf"): Promise<File> {
  const pages: Page[] = [];
  for (const f of files) pages.push(await toPage(f));

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (d: Uint8Array | string) => {
    const b = typeof d === "string" ? enc.encode(d) : d;
    chunks.push(b);
    length += b.length;
  };
  const obj = (n: number, body: Uint8Array | string, head = "", tail = "") => {
    offsets[n] = length;
    push(`${n} 0 obj\n${head}`);
    push(body);
    push(`${tail}\nendobj\n`);
  };

  // Object ids: 1 catalog, 2 page tree, then per page: page, content, image.
  push("%PDF-1.4\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);

  pages.forEach((p, i) => {
    const pageId = 3 + i * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const landscape = p.w > p.h;
    const pw = landscape ? A4_H : A4_W;
    const ph = landscape ? A4_W : A4_H;
    const s = Math.min(pw / p.w, ph / p.h);
    const dw = p.w * s;
    const dh = p.h * s;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;
    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;

    obj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    obj(contentId, content, `<< /Length ${content.length} >>\nstream\n`, "\nendstream");
    obj(
      imageId,
      p.jpeg,
      `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
      "\nendstream",
    );
  });

  const total = 3 + pages.length * 3;
  const xref = length;
  let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) table += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  push(table);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);

  return new File(chunks as BlobPart[], name, { type: "application/pdf" });
}

/**
 * Turns whatever the user picked into the single file stored per document: one file is used as-is,
 * several images are merged into one PDF (in the order picked). A PDF cannot be mixed with others.
 */
export async function combinePickedFiles(files: File[], docName: string): Promise<{ file: File } | { error: string }> {
  if (files.length === 0) return { error: "No file was chosen." };
  if (files.length === 1) return { file: files[0] };
  if (files.some((f) => f.type === "application/pdf")) {
    return { error: "Select either one PDF or several images — not both." };
  }
  try {
    return { file: await imagesToPdf(files, `${docName.replace(/[^\w-]+/g, "_") || "document"}.pdf`) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not combine the images. Please try again." };
  }
}
