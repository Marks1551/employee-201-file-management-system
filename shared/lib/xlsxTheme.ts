// Shared ExcelJS styling theme for every report export in the app (the
// Employee 201 File Workbook, Employee List Report, and Document Status
// Report), so they all share one look — same wine/maroon palette, borders,
// and download behavior — instead of each report inventing its own.

import type ExcelJS from 'exceljs';

export const COLOR = {
  banner: 'FF7A3350',
  bannerSub: 'FF95536E',
  fieldBg: 'FFF8E6EC',
  fieldAltBg: 'FFFDF7F9',
  border: 'FFE3C1CC',
  textDark: 'FF3D1524',
  textMuted: 'FF7A5A65',
  white: 'FFFFFFFF',
} as const;

export const thinBorder = { style: 'thin' as const, color: { argb: COLOR.border } };
export const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

export function setColumnWidths(ws: ExcelJS.Worksheet, widths: number[]) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

/** Full-width title banner (e.g. report name + generated date) in a maroon bar. */
export function titleBanner(ws: ExcelJS.Worksheet, row: number, cols: number, text: string) {
  ws.mergeCells(row, 1, row, cols);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: COLOR.white } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.banner } };
  ws.getRow(row).height = 24;
}

/** Styled table header row (maroon fill, white bold text, borders). */
export function headerRow(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.banner } };
    cell.border = allBorders;
  });
  ws.getRow(row).height = 20;
}

/** Styled data row with alternating shading and borders. */
export function dataRow(ws: ExcelJS.Worksheet, row: number, values: (string | number)[], shaded: boolean) {
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v === '' ? '—' : v;
    cell.font = { name: 'Calibri', size: 10, color: { argb: COLOR.textDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    if (shaded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fieldAltBg } };
    cell.border = allBorders;
  });
  ws.getRow(row).height = 18;
}

export function downloadWorkbookBuffer(buffer: ArrayBuffer | Uint8Array, filename: string) {
  // TS's DOM lib types `Blob`'s constructor to require an ArrayBuffer-backed view, but
  // `Uint8Array` is now generic over `ArrayBufferLike` (which also covers SharedArrayBuffer),
  // so a plain `Uint8Array` no longer structurally satisfies `BlobPart`. The buffer we're
  // actually given here (from ExcelJS/exceljs's `workbook.xlsx.writeBuffer()`) is always a
  // real ArrayBuffer, never shared memory — this assertion just tells the compiler that.
  const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
