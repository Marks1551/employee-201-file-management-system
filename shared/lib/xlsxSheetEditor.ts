// Minimal, dependency-free editor for the worksheet XML inside an .xlsx file.
//
// Why this exists: the official CS Form 212 template is full of things ExcelJS
// (and SheetJS) throw away when they load and re-save a workbook — real form-control
// checkboxes, the country dropdown, text boxes, print setup. To keep the exported
// PDS identical to the template, we leave every part of the file alone and only
// rewrite the few <c> (cell) elements we fill in, keeping each cell's existing style.

const XML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Escapes text for XML and drops characters XML 1.0 can't carry. */
export function escapeXml(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "").replace(/[&<>"]/g, (ch) => XML_ESCAPES[ch]);
}

export function colToNumber(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function parseCellRef(ref: string): { col: number; row: number } {
  const m = /^([A-Za-z]+)(\d+)$/.exec(ref);
  if (!m) throw new Error(`Bad cell reference: ${ref}`);
  return { col: colToNumber(m[1]), row: Number(m[2]) };
}

export type CellValue = string | number | boolean | null | undefined;

interface RowModel {
  attrs: string;
  cells: Map<number, string>; // column number -> full <c .../> xml
  touched: boolean;
}

const ROW_RE = /<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g;
const CELL_RE = /<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;

export class SheetEditor {
  private head: string;
  private tail: string;
  private rows = new Map<number, RowModel>();

  constructor(xml: string) {
    const open = xml.indexOf("<sheetData");
    const close = xml.indexOf("</sheetData>");
    if (open < 0) throw new Error("Worksheet has no <sheetData>");
    const openEnd = xml.indexOf(">", open) + 1;
    if (xml[openEnd - 2] === "/") {
      // <sheetData/> — an empty sheet
      this.head = xml.slice(0, open) + "<sheetData>";
      this.tail = "</sheetData>" + xml.slice(openEnd);
      return;
    }
    this.head = xml.slice(0, open);
    this.tail = xml.slice(close + "</sheetData>".length);
    const inner = xml.slice(openEnd, close);
    for (const rowXml of inner.match(ROW_RE) ?? []) {
      const open = /^<row\b([^>]*?)\/?>/.exec(rowXml)!;
      const attrs = open[1].replace(/\s*\/$/, "");
      const rNum = Number(/\br="(\d+)"/.exec(attrs)?.[1]);
      if (!rNum) continue;
      const cells = new Map<number, string>();
      const body = rowXml.endsWith("/>") && !rowXml.includes("</row>") ? "" : rowXml.slice(open[0].length);
      for (const cellXml of body.match(CELL_RE) ?? []) {
        const ref = /\br="([A-Za-z]+\d+)"/.exec(cellXml)?.[1];
        if (ref) cells.set(parseCellRef(ref).col, cellXml);
      }
      this.rows.set(rNum, { attrs, cells, touched: false });
    }
    this.head += "<sheetData>";
    this.tail = "</sheetData>" + this.tail;
  }

  /** True once any cell has been written (used to skip untouched continuation sheets). */
  hasEdits(): boolean {
    for (const row of this.rows.values()) if (row.touched) return true;
    return false;
  }

  /** Sets a row's height in points. */
  setRowHeight(row: number, height: number): void {
    let model = this.rows.get(row);
    if (!model) {
      model = { attrs: ` r="${row}"`, cells: new Map(), touched: true };
      this.rows.set(row, model);
    }
    model.touched = true;
    model.attrs = model.attrs.replace(/\s(?:ht|customHeight)="[^"]*"/g, "") + ` ht="${height}" customHeight="1"`;
  }

  /**
   * Sets a cell's value, keeping its existing style (or using `style`, a cellXfs index, when given).
   * null/undefined/"" clears the value.
   */
  set(ref: string, value: CellValue, style?: number): void {
    const { col, row } = parseCellRef(ref);
    let rowModel = this.rows.get(row);
    if (!rowModel) {
      rowModel = { attrs: ` r="${row}"`, cells: new Map(), touched: true };
      this.rows.set(row, rowModel);
    }
    rowModel.touched = true;
    const existing = rowModel.cells.get(col);
    const keptStyle = existing ? /\bs="(\d+)"/.exec(existing.slice(0, existing.indexOf(">") + 1))?.[1] : undefined;
    const useStyle = style !== undefined ? String(style) : keptStyle;
    const base = `<c r="${ref.toUpperCase()}"${useStyle ? ` s="${useStyle}"` : ""}`;
    let xml: string;
    if (value === null || value === undefined || value === "") {
      xml = `${base}/>`;
    } else if (typeof value === "boolean") {
      xml = `${base} t="b"><v>${value ? 1 : 0}</v></c>`;
    } else if (typeof value === "number") {
      xml = `${base}><v>${value}</v></c>`;
    } else {
      xml = `${base} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }
    rowModel.cells.set(col, xml);
  }

  toString(): string {
    const out: string[] = [];
    for (const rNum of [...this.rows.keys()].sort((a, b) => a - b)) {
      const row = this.rows.get(rNum)!;
      // `spans` is only an optimisation hint; drop it where we've added cells so it can't be wrong.
      const attrs = row.touched ? row.attrs.replace(/\sspans="[^"]*"/, "") : row.attrs;
      const cells = [...row.cells.keys()].sort((a, b) => a - b).map((c) => row.cells.get(c)!);
      out.push(cells.length ? `<row${attrs}>${cells.join("")}</row>` : `<row${attrs}/>`);
    }
    return this.head + out.join("") + this.tail;
  }
}
