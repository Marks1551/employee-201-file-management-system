// Styled Excel exports for the Employee List Report and Document Status
// Report — same wine/maroon theme, borders, and column sizing as the
// Employee 201 File Workbook (see xlsxTheme.ts and employeeWorkbook.ts),
// so every report generated from the Reports page looks consistent.

import ExcelJS from "exceljs";
import type { Employee } from "@/shared/types";
import { expiryText } from "@/shared/lib/documentExpiry";
import {
  COLOR,
  allBorders,
  titleBanner,
  headerRow,
  dataRow,
  setColumnWidths,
  downloadWorkbookBuffer,
} from "@/shared/lib/xlsxTheme";

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

const LIST_SHEET = "Employee List";

/** Excel sheet names: <=31 chars, no \\ / ? * [ ] : and unique within the workbook. */
function uniqueSheetName(raw: string, used: Set<string>): string {
  const base = (
    raw
      .replace(/[\\/?*[\]:]/g, "-")
      .replace(/^'+|'+$/g, "")
      .trim() || "Employee"
  ).slice(0, 31);
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n++})`;
    name = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(name.toLowerCase());
  return name;
}

/** Internal link target for a sheet: #'Sheet name'!A1 */
function sheetLink(name: string): string {
  return `#'${name.replace(/'/g, "''")}'!A1`;
}

/**
 * Link styled like the Employee 201 File Workbook: bold, underlined maroon text on a soft
 * pink fill. "view" = the bordered, centered "View →" button on the list; "back" = the
 * borderless, left-aligned "← Back to Employee List" link on each employee sheet.
 */
function linkCell(cell: ExcelJS.Cell, text: string, name: string, kind: "view" | "back") {
  cell.value = { text, hyperlink: sheetLink(name), tooltip: `Go to ${name}` };
  cell.font = { name: "Calibri", size: 10, bold: true, underline: true, color: { argb: COLOR.banner } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.fieldBg } };
  if (kind === "view") {
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = allBorders;
  } else {
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  }
}

function sectionBar(ws: ExcelJS.Worksheet, row: number, cols: number, text: string) {
  ws.mergeCells(row, 1, row, cols);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLOR.white } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.bannerSub } };
  ws.getRow(row).height = 20;
}

function docStatusLabel(status: string): string {
  if (status === "uploaded") return "Uploaded";
  if (status === "pending") return "Pending Review";
  return "Missing";
}

/**
 * Builds and downloads the Employee List Report (.xlsx), laid out like the
 * Employee 201 File Workbook: a main "Employee List" sheet with only the key
 * details (employee number, name, department, position, hire date, status,
 * documents uploaded), and a sheet for every employee with their full details
 * and document statuses. "View →" on the list jumps to the employee's sheet,
 * and each employee sheet links back to the list.
 */
export async function exportEmployeeListReport(
  employees: Employee[],
  filename = "employee-list-report.xlsx",
  scopeLabel = "",
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "201 File System";
  wb.created = new Date();

  const used = new Set<string>([LIST_SHEET.toLowerCase()]);
  const sheetNames = employees.map((e) => uniqueSheetName(`${e.employeeNumber} ${e.displayName}`, used));

  // ---- main sheet: key details only ---------------------------------------------------
  const headers = [
    "Employee #",
    "Name",
    "Department",
    "Position",
    "Date Hired",
    "Status",
    "Documents",
    "Employee Page",
  ];
  const widths = [14, 28, 22, 22, 16, 16, 14, 16];

  const list = wb.addWorksheet(LIST_SHEET, { views: [{ showGridLines: true, state: "frozen", ySplit: 3 }] });
  setColumnWidths(list, widths);
  titleBanner(
    list,
    1,
    headers.length,
    `Employee List Report${scopeLabel ? ` — ${scopeLabel}` : ""} — Generated ${todayLabel()}`,
  );
  list.getRow(2).height = 6; // spacer
  headerRow(list, 3, headers);

  employees.forEach((e, idx) => {
    const row = 4 + idx;
    const uploaded = e.documents.filter((d) => d.status === "uploaded").length;
    dataRow(
      list,
      row,
      [
        e.employeeNumber,
        e.displayName,
        e.department || "",
        e.position || "",
        e.dateHired || "",
        e.employmentStatus || "",
        `${uploaded} / ${e.documents.length}`,
        "View →",
      ],
      idx % 2 === 1,
    );
    linkCell(list.getCell(row, headers.length), "View →", sheetNames[idx], "view");
  });

  list.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: Math.max(employees.length + 3, 3), column: headers.length },
  };

  // ---- one sheet per employee: details + documents -----------------------------------
  employees.forEach((e, idx) => {
    const name = sheetNames[idx];
    const ws = wb.addWorksheet(name);
    const cols = 4;
    setColumnWidths(ws, [34, 18, 22, 34]);

    titleBanner(ws, 1, cols, `${e.displayName} — Employee Record — Generated ${todayLabel()}`);
    linkCell(ws.getCell(2, 1), "← Back to Employee List", LIST_SHEET, "back");
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 6; // spacer

    sectionBar(ws, 4, cols, "Employee Details");
    const accountStatus =
      (e.status || "active") !== "active"
        ? `Inactive — ${e.deactivationReason || "n/a"}${e.deactivatedAt ? ` (${e.deactivatedAt})` : ""}`
        : "Active";
    const details: [string, string][] = [
      ["Employee #", e.employeeNumber],
      ["Name", e.displayName],
      ["Department", e.department || ""],
      ["Position", e.position || ""],
      ["Date Hired", e.dateHired || ""],
      ["Employment Status", e.employmentStatus || ""],
      ["Contract Start", e.contractStart || ""],
      ["Contract End", e.employmentStatus === "Regular" ? "N/A" : e.contractEnd || ""],
      ["Account Status", accountStatus],
      ["Email", e.email || ""],
      ["Contact", e.contact || ""],
    ];
    let row = 5;
    details.forEach(([label, value]) => {
      const l = ws.getCell(row, 1);
      l.value = label;
      l.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLOR.textDark } };
      l.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
      l.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR.fieldBg } };
      l.border = allBorders;
      ws.mergeCells(row, 2, row, cols);
      const v = ws.getCell(row, 2);
      v.value = value || "—";
      v.font = { name: "Calibri", size: 10, color: { argb: COLOR.textDark } };
      v.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
      for (let c = 2; c <= cols; c++) ws.getCell(row, c).border = allBorders;
      ws.getRow(row).height = 18;
      row += 1;
    });

    row += 1; // spacer
    const uploaded = e.documents.filter((d) => d.status === "uploaded").length;
    sectionBar(ws, row, cols, `Documents — ${uploaded} of ${e.documents.length} uploaded`);
    row += 1;
    headerRow(ws, row, ["Document", "Status", "Uploaded", "Expires"]);
    row += 1;

    if (e.documents.length === 0) {
      dataRow(ws, row, ["No documents on record", "", "", ""], false);
    } else {
      e.documents.forEach((d, i) => {
        dataRow(ws, row, [d.name, docStatusLabel(d.status), d.uploaded || "—", expiryText(d)], i % 2 === 1);
        const statusCell = ws.getCell(row, 2);
        const argb = d.status === "uploaded" ? "FF2E7D32" : d.status === "pending" ? "FFB26A00" : "FFB00020";
        statusCell.font = { name: "Calibri", size: 10, bold: true, color: { argb } };
        row += 1;
      });
    }
  });

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer as unknown as ArrayBuffer | Uint8Array, filename);
}

/**
 * Builds and downloads the Document Status Report (.xlsx): every required
 * document per employee, with upload status.
 */
export async function exportDocumentStatusReport(
  employees: Employee[],
  filename = "document-status-report.xlsx",
  scopeLabel = "",
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "201 File System";
  wb.created = new Date();

  const headers = ["Employee #", "Name", "Department", "Document", "Status", "Uploaded", "Expires"];
  const widths = [14, 26, 22, 30, 14, 16, 30];

  const ws = wb.addWorksheet("Document Status", { views: [{ showGridLines: true, state: "frozen", ySplit: 3 }] });
  setColumnWidths(ws, widths);

  titleBanner(
    ws,
    1,
    headers.length,
    `Document Status Report${scopeLabel ? ` — ${scopeLabel}` : ""} — Generated ${todayLabel()}`,
  );
  ws.getRow(2).height = 6; // spacer
  headerRow(ws, 3, headers);

  let row = 4;
  let shadeIdx = 0;
  employees.forEach((e) => {
    e.documents.forEach((d) => {
      dataRow(
        ws,
        row,
        [
          e.employeeNumber,
          e.displayName,
          e.department || "",
          d.name,
          d.status === "uploaded" ? "Uploaded" : "Missing",
          d.uploaded || "—",
          expiryText(d),
        ],
        shadeIdx % 2 === 1,
      );
      row += 1;
      shadeIdx += 1;
    });
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(row - 1, 3), column: headers.length } };

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer as unknown as ArrayBuffer | Uint8Array, filename);
}
