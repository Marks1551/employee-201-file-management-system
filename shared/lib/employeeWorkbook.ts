// Builds the "Employee 201 File Workbook": one .xlsx with an "Employees" list sheet and,
// for every employee, their actual Personal Data Sheet — the official CS Form No. 212
// (Revised 2026), filled in with their records.
//
// Clicking "View PDS →" on the list jumps to that employee's page 1 (C1). Their pages
// C1–C4 follow it (plus any continuation sheets C5–C11 the employee's records overflow
// onto), and each page has a "← Back to Employee List" link.
//
// How it works: every employee's pages are copies of the real template's sheets (same
// styles.xml, so formatting, merged cells, checkboxes, the country dropdown, text boxes
// and print areas carry over exactly). The template is opened with JSZip and its parts
// are cloned under new names — nothing is re-drawn — then the value cells are filled by
// the same code the single-employee PDS export uses (see pdsWorkbook.ts).

import JSZip from "jszip";
import type { Employee } from "@/shared/types";
import { escapeXml, SheetEditor } from "@/shared/lib/xlsxSheetEditor";
import {
  PDS_TEMPLATE_URL,
  SHEET_PART,
  addPhoto,
  fillPdsForm,
  loadPhoto,
  put,
  syncControls,
  type PdsPhoto,
  type SheetKey,
} from "@/shared/lib/pdsWorkbook";
import { downloadWorkbookBuffer } from "@/shared/lib/xlsxTheme";

const EMPLOYEES_SHEET = "Employees";

/** The pages of the form, in order. C1–C4 are always included; the rest only when used. */
const PAGE_ORDER: SheetKey[] = ["C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "C10", "C11"];
const ALWAYS: SheetKey[] = ["C1", "C2", "C3", "C4"];

/** Print areas of the template's pages (the template's own settings). */
const PRINT_AREA: Partial<Record<SheetKey, string>> = {
  C1: "$A$1:$N$62",
  C2: "$A$2:$M$44",
  C3: "$A$1:$K$48",
  C4: "$A$1:$N$71",
  C5: "$A$2:$K$51",
  C6: "$A$2:$M$41",
  C7: "$A$2:$L$25",
  C9: "$A$2:$K$30",
  C10: "$A$1:$K$36",
  C11: "$A$1:$K$36",
};

/** Where each page's "back to list" link sits: a free cell to the right of the printed area. */
const BACK_LINK_REF: Record<SheetKey, string> = {
  C1: "R2", // P:Q are hidden on this page
  C2: "P2",
  C3: "P2",
  C4: "P2",
  C5: "P2",
  C6: "P2",
  C7: "Q2", // column O holds this page's country list
  C8: "P2",
  C9: "P2",
  C10: "P2",
  C11: "P2",
};

const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Excel sheet names: <=31 chars, no  \ / ? * [ ] : , can't be blank. */
function cleanSheetName(raw: string): string {
  const cleaned = raw
    .replace(/[\\/?*[\]:]/g, "-")
    .replace(/^'+|'+$/g, "")
    .trim();
  return cleaned || "Employee";
}

function statusLabel(employee: Employee): string {
  if ((employee.status || "active") !== "active") {
    return `Inactive — ${employee.deactivationReason || "n/a"}${employee.deactivatedAt ? ` (${employee.deactivatedAt})` : ""}`;
  }
  return "Active";
}

/** Quotes a sheet name for use inside a formula/link: 'My Sheet'. */
function quoteSheet(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

// ---------------------------------------------------------------------------
// Styles — a few cell formats appended to the template's own styles.xml
// ---------------------------------------------------------------------------

interface ListStyles {
  title: number;
  head: number;
  body: number;
  bodyAlt: number;
  link: number;
  note: number;
  back: number;
}

// Same wine/maroon palette as the other report exports (see xlsxTheme.ts).
const C = {
  banner: "FF7A3350",
  fieldBg: "FFF8E6EC",
  alt: "FFFDF7F9",
  border: "FFE3C1CC",
  text: "FF3D1524",
  muted: "FF7A5A65",
  white: "FFFFFFFF",
};

function appendStyles(stylesXml: string): { xml: string; ids: ListStyles } {
  let xml = stylesXml;
  const append = (tag: string, items: string[]): number => {
    const countRe = new RegExp(`<${tag} count="(\\d+)"`);
    const base = Number(countRe.exec(xml)![1]);
    xml = xml.replace(countRe, `<${tag} count="${base + items.length}"`);
    xml = xml.replace(`</${tag}>`, `${items.join("")}</${tag}>`);
    return base;
  };

  const font = (opts: { b?: boolean; i?: boolean; u?: boolean; sz: number; color: string }) =>
    `<font>${opts.b ? "<b/>" : ""}${opts.i ? "<i/>" : ""}${opts.u ? "<u/>" : ""}<sz val="${opts.sz}"/><color rgb="${opts.color}"/><name val="Calibri"/><family val="2"/></font>`;
  const f0 = append("fonts", [
    font({ b: true, sz: 13, color: C.white }), // title
    font({ b: true, sz: 10.5, color: C.white }), // header
    font({ sz: 10, color: C.text }), // body
    font({ b: true, u: true, sz: 10, color: C.banner }), // link
    font({ i: true, sz: 9.5, color: C.muted }), // note
  ]);

  const fill = (rgb: string) =>
    `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/><bgColor indexed="64"/></patternFill></fill>`;
  const fl0 = append("fills", [fill(C.banner), fill(C.fieldBg), fill(C.alt)]);

  const side = (n: string) => `<${n} style="thin"><color rgb="${C.border}"/></${n}>`;
  const b0 = append("borders", [
    `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`,
  ]);

  const xf = (fontId: number, fillId: number, borderId: number, align: string) =>
    `<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="${fillId ? 1 : 0}" applyBorder="${borderId ? 1 : 0}" applyAlignment="1"><alignment ${align}/></xf>`;
  const left = 'horizontal="left" vertical="center" indent="1"';
  const x0 = append("cellXfs", [
    xf(f0, fl0, 0, left), // title
    xf(f0 + 1, fl0, b0, left), // head
    xf(f0 + 2, 0, b0, left), // body
    xf(f0 + 2, fl0 + 2, b0, left), // bodyAlt
    xf(f0 + 3, fl0 + 1, b0, 'horizontal="center" vertical="center"'), // link
    xf(f0 + 4, 0, 0, 'horizontal="left" vertical="center" wrapText="1" indent="1"'), // note
    xf(f0 + 3, fl0 + 1, 0, 'horizontal="left" vertical="center" indent="1"'), // back link
  ]);

  return {
    xml,
    ids: { title: x0, head: x0 + 1, body: x0 + 2, bodyAlt: x0 + 3, link: x0 + 4, note: x0 + 5, back: x0 + 6 },
  };
}

// ---------------------------------------------------------------------------
// The "Employees" list sheet
// ---------------------------------------------------------------------------

const LIST_HEADERS = [
  "Employee #",
  "Name",
  "Department",
  "Position",
  "Employment Type",
  "Status",
  "Date Hired",
  "View PDS",
];
const LIST_WIDTHS = [14, 28, 22, 24, 18, 28, 16, 14];
const LIST_FIRST_ROW = 4; // 1 title, 2 note, 3 header

/** Column letter for a 1-based index (A..H is all this sheet needs). */
const colLetter = (n: number) => String.fromCharCode(64 + n);

const LIST_NOTE =
  "Click “View PDS →” beside any name to open that employee’s actual Personal Data Sheet (CS Form No. 212, Revised 2026), " +
  "filled in with their records. Use “← Back to Employee List” (to the right of each page) or this tab to return.";

function buildListSheet(
  employees: Employee[],
  firstSheetOf: Map<string, string>,
  ids: ListStyles,
  generated: string,
): string {
  const lastCol = colLetter(LIST_HEADERS.length);
  const lastRow = Math.max(employees.length + LIST_FIRST_ROW - 1, LIST_FIRST_ROW - 1);
  const cols = LIST_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const links = employees.map((e, i) => {
    const ref = `${lastCol}${LIST_FIRST_ROW + i}`;
    return `<hyperlink ref="${ref}" location="${escapeXml(quoteSheet(firstSheetOf.get(e.id)!) + "!A1")}" display="View PDS →"/>`;
  });

  const skeleton =
    XML_HEAD +
    `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="${LIST_FIRST_ROW - 1}" topLeftCell="A${LIST_FIRST_ROW}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A${LIST_FIRST_ROW}" sqref="A${LIST_FIRST_ROW}"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="18" customHeight="1"/>` +
    `<cols>${cols}</cols>` +
    `<sheetData/>` +
    (employees.length ? `<autoFilter ref="A${LIST_FIRST_ROW - 1}:${lastCol}${lastRow}"/>` : "") +
    `<mergeCells count="2"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/></mergeCells>` +
    (links.length ? `<hyperlinks>${links.join("")}</hyperlinks>` : "") +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup orientation="landscape" fitToHeight="0"/>` +
    `</worksheet>`;

  const ed = new SheetEditor(skeleton);
  ed.set("A1", `Employee 201 File Workbook — Generated ${generated}`, ids.title);
  for (let c = 2; c <= LIST_HEADERS.length; c++) ed.set(`${colLetter(c)}1`, "", ids.title);
  ed.setRowHeight(1, 24);
  ed.set("A2", LIST_NOTE, ids.note);
  for (let c = 2; c <= LIST_HEADERS.length; c++) ed.set(`${colLetter(c)}2`, "", ids.note);
  ed.setRowHeight(2, 32);
  LIST_HEADERS.forEach((h, i) => ed.set(`${colLetter(i + 1)}3`, h, ids.head));
  ed.setRowHeight(3, 20);

  employees.forEach((e, idx) => {
    const row = LIST_FIRST_ROW + idx;
    const style = idx % 2 === 1 ? ids.bodyAlt : ids.body;
    const values = [
      e.employeeNumber,
      e.displayName,
      e.department || "",
      e.position || "",
      e.employmentType || "",
      statusLabel(e),
      e.dateHired || "",
    ];
    values.forEach((v, c) => ed.set(`${colLetter(c + 1)}${row}`, v === "" ? "—" : v, style));
    ed.set(`${lastCol}${row}`, "View PDS →", ids.link);
  });
  return ed.toString();
}

// ---------------------------------------------------------------------------
// Cloning the template's pages
// ---------------------------------------------------------------------------

interface Rel {
  id: string;
  type: string;
  target: string;
}

function parseRels(xml: string | undefined): Rel[] {
  if (!xml) return [];
  return [...xml.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => ({
    id: /Id="([^"]*)"/.exec(m[0])![1],
    type: /Type="([^"]*)"/.exec(m[0])![1],
    target: /Target="([^"]*)"/.exec(m[0])![1],
  }));
}

/**
 * Makes a copy of a template page safe to live next to other copies: drops the parts that
 * are tied to the template's own package (printer settings, custom views, the country-site
 * hyperlinks, duplicated ids), opens it in normal view, and adds the "back to list" link.
 */
function finalizePage(xml: string, backRef: string): string {
  let out = xml
    .replace(/<customSheetViews>[\s\S]*?<\/customSheetViews>/, "")
    .replace(/<hyperlinks>[\s\S]*?<\/hyperlinks>/, "")
    .replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, "$1")
    .replace(/<worksheet\b[^>]*>/, (tag) => tag.replace(/\s+xr:uid="[^"]*"/, ""))
    .replace(/(<sheetPr\b[^>]*?)\s+codeName="[^"]*"/, "$1")
    .replace(/<sheetView\b[^>]*>/, (tag) => {
      const normal = Math.max(Number(/zoomScaleNormal="(\d+)"/.exec(tag)?.[1] ?? 100), 70);
      const grid = /showGridLines="0"/.test(tag) ? ' showGridLines="0"' : "";
      return `<sheetView${grid} zoomScale="${normal}" zoomScaleNormal="${normal}" workbookViewId="0">`;
    })
    .replace(/<selection\b[^>]*\/>/, '<selection activeCell="A1" sqref="A1"/>');

  const link = `<hyperlinks><hyperlink ref="${backRef}" location="${escapeXml(quoteSheet(EMPLOYEES_SHEET) + "!A1")}" display="← Back to Employee List"/></hyperlinks>`;
  out = /<printOptions\b/.test(out)
    ? out.replace(/<printOptions\b/, `${link}<printOptions`)
    : out.replace(/<pageMargins\b/, `${link}<pageMargins`);
  return out;
}

export interface WorkbookEmployee {
  employee: Employee;
  photo?: PdsPhoto | null;
}

/**
 * Builds the workbook bytes from the CS Form 212 template and the employees (pure — no network),
 * so it can be tested outside the browser.
 */
export async function buildEmployeeWorkbookXlsx(
  template: ArrayBuffer | Uint8Array,
  items: WorkbookEmployee[],
  generatedLabel = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
): Promise<Uint8Array> {
  const tpl = await JSZip.loadAsync(template);
  const read = async (path: string) => tpl.file(path)?.async("string");

  // Raw template pages (read once, filled once per employee).
  const sheetXml = {} as Record<SheetKey, string>;
  const sheetRels = {} as Record<SheetKey, Rel[]>;
  for (const key of PAGE_ORDER) {
    sheetXml[key] = (await read(`xl/worksheets/sheet${SHEET_PART[key]}.xml`))!;
    sheetRels[key] = parseRels(await read(`xl/worksheets/_rels/sheet${SHEET_PART[key]}.xml.rels`));
  }

  const out = new JSZip();
  const sheetsMeta: { name: string; part: number; printArea?: string }[] = [];
  const overrides: string[] = [];
  const addOverride = (partName: string, contentType: string) =>
    overrides.push(`<Override PartName="${partName}" ContentType="${contentType}"/>`);

  // Sheet names: "Employees" first, then "<employee #> C1", "<employee #> C2", …
  const used = new Set<string>([EMPLOYEES_SHEET.toLowerCase()]);
  const prefixOf = new Map<string, string>();
  items.forEach(({ employee: e }) => {
    const base = cleanSheetName(e.employeeNumber || e.displayName).slice(0, 22);
    let prefix = base;
    let n = 2;
    while (used.has(`${prefix} c1`.toLowerCase())) prefix = `${base.slice(0, 22 - String(n).length - 1)}-${n++}`;
    used.add(`${prefix} c1`.toLowerCase());
    prefixOf.set(e.id, prefix);
  });
  const firstSheetOf = new Map<string, string>();
  items.forEach(({ employee: e }) => firstSheetOf.set(e.id, `${prefixOf.get(e.id)} C1`));

  // Styles (template's + our list formats).
  const styles = appendStyles((await read("xl/styles.xml"))!);
  put(out, "xl/styles.xml", styles.xml);
  put(out, "xl/theme/theme1.xml", (await read("xl/theme/theme1.xml"))!);
  put(out, "xl/sharedStrings.xml", (await read("xl/sharedStrings.xml"))!);

  // Sheet 1: the list.
  const listXml = buildListSheet(
    items.map((i) => i.employee),
    firstSheetOf,
    styles.ids,
    generatedLabel,
  );
  put(out, "xl/worksheets/sheet1.xml", listXml);
  addOverride("/xl/worksheets/sheet1.xml", "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml");
  sheetsMeta.push({ name: EMPLOYEES_SHEET, part: 1 });

  // Each employee's pages.
  let nextSheet = 2;
  let nextDrawing = 1;
  let nextVml = 1;
  let nextCtrl = 1;
  const post: {
    relsC1: string;
    relsC4: string;
    drawingC4: string;
    filled: ReturnType<typeof fillPdsForm>;
    photo?: PdsPhoto | null;
    idx: number;
  }[] = [];

  for (let idx = 0; idx < items.length; idx++) {
    const { employee, photo } = items[idx];
    const filled = fillPdsForm(sheetXml, employee);
    const prefix = prefixOf.get(employee.id)!;
    let relsC1 = "";
    let relsC4 = "";
    let drawingC4 = "";

    for (const key of PAGE_ORDER) {
      if (!ALWAYS.includes(key) && !filled.editors[key].hasEdits()) continue;
      const part = nextSheet++;
      const backRef = BACK_LINK_REF[key];
      filled.editors[key].set(backRef, "← Back to Employee List", styles.ids.back);
      put(out, `xl/worksheets/sheet${part}.xml`, finalizePage(filled.editors[key].toString(), backRef));
      addOverride(
        `/xl/worksheets/sheet${part}.xml`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
      );
      sheetsMeta.push({ name: `${prefix} ${key}`, part, printArea: PRINT_AREA[key] });

      // Form controls / drawings of this page: cloned under new names, same relationship ids.
      const rels: string[] = [];
      for (const rel of sheetRels[key]) {
        const file = rel.target.replace(/^\.\.\//, "");
        if (rel.type === `${REL_TYPE}/drawing`) {
          const name = `drawing${nextDrawing++}.xml`;
          put(out, `xl/drawings/${name}`, (await read(`xl/${file}`))!);
          addOverride(`/xl/drawings/${name}`, "application/vnd.openxmlformats-officedocument.drawing+xml");
          rels.push(`<Relationship Id="${rel.id}" Type="${rel.type}" Target="../drawings/${name}"/>`);
          if (key === "C4") drawingC4 = `xl/drawings/${name}`;
        } else if (rel.type === `${REL_TYPE}/vmlDrawing`) {
          const name = `vmlDrawing${nextVml++}.vml`;
          put(out, `xl/drawings/${name}`, (await read(`xl/${file}`))!);
          rels.push(`<Relationship Id="${rel.id}" Type="${rel.type}" Target="../drawings/${name}"/>`);
        } else if (rel.type === `${REL_TYPE}/ctrlProp`) {
          const name = `ctrlProp${nextCtrl++}.xml`;
          put(out, `xl/ctrlProps/${name}`, (await read(`xl/${file}`))!);
          addOverride(`/xl/ctrlProps/${name}`, "application/vnd.ms-excel.controlproperties+xml");
          rels.push(`<Relationship Id="${rel.id}" Type="${rel.type}" Target="../ctrlProps/${name}"/>`);
        }
        // hyperlinks and printer settings belong to the template package and are dropped.
      }
      if (rels.length) {
        const relsPath = `xl/worksheets/_rels/sheet${part}.xml.rels`;
        put(
          out,
          relsPath,
          `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`,
        );
        if (key === "C1") relsC1 = relsPath;
        if (key === "C4") relsC4 = relsPath;
      }
    }
    post.push({ relsC1, relsC4, drawingC4, filled, photo, idx });
  }

  // Workbook, relationships, content types, document properties.
  const sheetEls = sheetsMeta
    .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join("");
  const names: string[] = [];
  if (items.length) {
    names.push(
      `<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${escapeXml(`${quoteSheet(EMPLOYEES_SHEET)}!$A$3:$${colLetter(LIST_HEADERS.length)}$${items.length + LIST_FIRST_ROW - 1}`)}</definedName>`,
    );
  }
  sheetsMeta.forEach((s, i) => {
    if (s.printArea) {
      names.push(
        `<definedName name="_xlnm.Print_Area" localSheetId="${i}">${escapeXml(`${quoteSheet(s.name)}!${s.printArea}`)}</definedName>`,
      );
    }
  });
  put(
    out,
    "xl/workbook.xml",
    `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><workbookPr/>` +
      `<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="23256" windowHeight="12456" tabRatio="850" activeTab="0"/></bookViews>` +
      `<sheets>${sheetEls}</sheets>` +
      (names.length ? `<definedNames>${names.join("")}</definedNames>` : "") +
      `<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
  );
  const n = sheetsMeta.length;
  put(
    out,
    "xl/_rels/workbook.xml.rels",
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheetsMeta
        .map(
          (s, i) =>
            `<Relationship Id="rId${i + 1}" Type="${REL_TYPE}/worksheet" Target="worksheets/sheet${s.part}.xml"/>`,
        )
        .join("") +
      `<Relationship Id="rId${n + 1}" Type="${REL_TYPE}/styles" Target="styles.xml"/>` +
      `<Relationship Id="rId${n + 2}" Type="${REL_TYPE}/theme" Target="theme/theme1.xml"/>` +
      `<Relationship Id="rId${n + 3}" Type="${REL_TYPE}/sharedStrings" Target="sharedStrings.xml"/>` +
      `</Relationships>`,
  );
  put(
    out,
    "_rels/.rels",
    `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${REL_TYPE}/officeDocument" Target="xl/workbook.xml"/>` +
      `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>` +
      `</Relationships>`,
  );
  put(
    out,
    "docProps/core.xml",
    `${XML_HEAD}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>201 File System</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`,
  );
  put(
    out,
    "[Content_Types].xml",
    `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>` +
      `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
      overrides.join("") +
      `</Types>`,
  );

  // Checkbox / dropdown state and the employee photo (these edit parts written above).
  for (const p of post) {
    if (p.relsC1) {
      await syncControls(
        out,
        p.relsC1,
        p.filled.c1Checks,
        p.filled.countryIndex ? { link: "J16", index: p.filled.countryIndex } : undefined,
      );
    }
    if (p.relsC4) await syncControls(out, p.relsC4, p.filled.c4Checks);
    if (p.photo && p.drawingC4) await addPhoto(out, p.photo, { drawingPath: p.drawingC4, key: String(p.idx) });
  }

  return out.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/**
 * Builds and downloads the Employee 201 File Workbook (.xlsx): an "Employees" sheet listing
 * everyone with a "View PDS →" link per row, and each employee's actual Personal Data Sheet
 * (CS Form No. 212, Revised 2026) filled in with their records.
 */
export async function exportEmployeeWorkbook(
  employees: Employee[],
  filename = "employee-201-file-workbook.xlsx",
): Promise<void> {
  const res = await fetch(PDS_TEMPLATE_URL);
  if (!res.ok) throw new Error("Could not load the CS Form 212 template.");
  const template = await res.arrayBuffer();
  const photos = await Promise.all(employees.map((e) => loadPhoto(e.photoUrl)));
  const bytes = await buildEmployeeWorkbookXlsx(
    template,
    employees.map((employee, i) => ({ employee, photo: photos[i] })),
  );
  downloadWorkbookBuffer(bytes, filename);
}
