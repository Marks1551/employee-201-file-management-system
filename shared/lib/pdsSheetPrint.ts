// Prints the Personal Data Sheet exactly as it looks in the on-screen form (the CS Form 212
// layout used by the edit view), instead of building a separate HTML document. The rendered
// sheets are cloned into a hidden print frame together with the app's own stylesheets, so the
// print can never drift from the form. Inputs are swapped for their current values (including
// unsaved edits) and edit-only controls (add / edit / delete buttons) are removed.

import { printHtmlDocument } from "./printDocument";

/** "2025-03-11" → "11/03/2025" (the form's dd/mm/yyyy). Anything else is left as typed. */
function dmy(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

const VALUE_CLASS = "min-h-[28px] min-w-0 flex-1 whitespace-pre-wrap break-words px-2 py-1 text-[12.5px]";

/** Replaces every input / textarea / select in `clone` with plain text showing `source`'s live value. */
function freezeControls(source: HTMLElement, clone: HTMLElement): void {
  const src = source.querySelectorAll<HTMLElement>("input, textarea, select");
  const dst = clone.querySelectorAll<HTMLElement>("input, textarea, select");
  src.forEach((el, i) => {
    const target = dst[i];
    if (!target) return;
    let text = "";
    if (el instanceof HTMLSelectElement) {
      text = el.value ? (el.selectedOptions[0]?.textContent ?? el.value) : "";
    } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
      text = el.checked ? "☑" : "☐";
    } else if (el instanceof HTMLInputElement && el.type === "date") {
      text = dmy(el.value);
    } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      text = el.value;
    }
    const div = clone.ownerDocument.createElement("div");
    div.className = VALUE_CLASS;
    div.textContent = text;
    target.replaceWith(div);
  });
}

const PRINT_CSS = `
  @page { size: A4 portrait; margin: 6mm; }
  html, body { margin: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  [data-print-hide] { display: none !important; }
  .pds-page {
    overflow: visible !important; border: 0 !important; border-radius: 0 !important;
    background: #fff !important; padding: 0 !important; margin: 0 !important;
    break-after: page; page-break-after: always;
    width: 1040px !important; zoom: 0.7; /* 1040px-wide form → fits A4 printable width */
  }
  .pds-page:last-child { break-after: auto; page-break-after: auto; }
  .pds-page-inner { min-width: 0 !important; max-width: none !important; width: 100% !important; }
  .pds-page tr, .pds-page-foot { break-inside: avoid; }
  .pds-page * { box-shadow: none !important; }
  .pds-page img { opacity: 1 !important; }
  .pds-page .animate-pulse { display: none !important; }
`;

/**
 * Opens the print dialog for the PDS sheets inside `root` (the `data-pds-sheets` container).
 * Falls back to the first mounted `[data-pds-sheets]` on the page when `root` is not given.
 * Returns false when there is nothing to print.
 */
export function printPdsSheets(root?: HTMLElement | null): boolean {
  const source = root ?? document.querySelector<HTMLElement>("[data-pds-sheets]");
  if (!source) return false;

  const clone = source.cloneNode(true) as HTMLElement;
  freezeControls(source, clone);
  clone.className = "";

  const head = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<base href="${document.baseURI}" />
<title>Personal Data Sheet</title>
${head}
<style>${PRINT_CSS}</style>
</head>
<body>${clone.outerHTML}</body>
</html>`;

  printHtmlDocument(html);
  return true;
}
