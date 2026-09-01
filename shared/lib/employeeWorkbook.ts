// Builds a styled "Employee 201 File" workbook: an "Employees" list sheet
// with a clickable "View" link per row, and one detail sheet per employee
// laid out like a colored HR profile card (banner header with photo, name,
// and position; labeled fields; and record tables), with a link back to
// the list. Uses ExcelJS so real fills, fonts, borders, and an embedded
// photo carry over into the downloaded .xlsx — plain SheetJS (used
// elsewhere in this app for exports) can't write cell styling.

import ExcelJS from 'exceljs';
import type { Employee } from '@/shared/types';
import { COLOR, thinBorder, allBorders, setColumnWidths, downloadWorkbookBuffer } from '@/shared/lib/xlsxTheme';

const EMPLOYEES_SHEET = 'Employees';
const COLS = 6; // A..F

/** Excel sheet names: <=31 chars, no  \ / ? * [ ] : , can't be blank. */
function sanitizeSheetName(raw: string): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, '-').replace(/^'+|'+$/g, '').trim();
  return (cleaned || 'Employee').slice(0, 31);
}

function uniqueSheetName(base: string, used: Set<string>): string {
  let name = sanitizeSheetName(base);
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const suffix = ` (${n})`;
    name = sanitizeSheetName(base).slice(0, 31 - suffix.length) + suffix;
    n += 1;
  }
  used.add(name.toLowerCase());
  return name;
}

function internalLink(sheetName: string): string {
  return `#'${sheetName.replace(/'/g, "''")}'!A1`;
}

function statusLabel(employee: Employee): string {
  if ((employee.status || 'active') !== 'active') {
    return `Inactive — ${employee.deactivationReason || 'n/a'}${employee.deactivatedAt ? ` (${employee.deactivatedAt})` : ''}`;
  }
  return 'Active';
}

/** Fetches an employee photo and returns it as a base64 data URL ExcelJS can embed, or null if unavailable. */
async function loadPhotoAsBase64(photoUrl: string): Promise<{ base64: string; extension: 'jpeg' | 'png' | 'gif' } | null> {
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const extension = contentType.includes('png') ? 'png' : contentType.includes('gif') ? 'gif' : contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpeg' : null;
    if (!extension) return null;
    const blob = await res.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { base64, extension };
  } catch {
    return null;
  }
}

function bannerRow(ws: ExcelJS.Worksheet, row: number, text: string, opts: { size: number; bold: boolean; fill: string; height?: number }) {
  ws.mergeCells(row, 1, row, COLS);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: opts.size, bold: opts.bold, color: { argb: COLOR.white } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
  ws.getRow(row).height = opts.height ?? 22;
}

function sectionBar(ws: ExcelJS.Worksheet, row: number, title: string) {
  ws.mergeCells(row, 1, row, COLS);
  const cell = ws.getCell(row, 1);
  cell.value = title.toUpperCase();
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR.white } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.banner } };
  ws.getRow(row).height = 20;
}

/** Label spanning cols 2:3, value spanning cols 4:COLS (shaded field box). */
function fieldRow(ws: ExcelJS.Worksheet, row: number, label: string, value: string | number | null | undefined, labelStartCol = 2) {
  ws.mergeCells(row, labelStartCol, row, labelStartCol + 1);
  const labelCell = ws.getCell(row, labelStartCol);
  labelCell.value = label;
  labelCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.textDark } };
  labelCell.alignment = { vertical: 'middle', horizontal: 'left' };

  const valueStartCol = labelStartCol + 2;
  ws.mergeCells(row, valueStartCol, row, COLS);
  const valueCell = ws.getCell(row, valueStartCol);
  valueCell.value = value === null || value === undefined || value === '' ? '—' : value;
  valueCell.font = { name: 'Calibri', size: 10, color: { argb: COLOR.textDark } };
  valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fieldBg } };
  for (let c = valueStartCol; c <= COLS; c++) ws.getCell(row, c).border = allBorders;

  ws.getRow(row).height = 18;
}

function tableHeaderRow(ws: ExcelJS.Worksheet, row: number, headers: string[]) {
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.bannerSub } };
    cell.border = allBorders;
  });
  ws.getRow(row).height = 18;
}

function tableDataRow(ws: ExcelJS.Worksheet, row: number, values: (string | number)[], shaded: boolean) {
  values.forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v === '' ? '—' : v;
    cell.font = { name: 'Calibri', size: 9.5, color: { argb: COLOR.textDark } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
    if (shaded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fieldAltBg } };
    cell.border = allBorders;
  });
}

function emptyNote(ws: ExcelJS.Worksheet, row: number, text: string) {
  ws.mergeCells(row, 1, row, COLS);
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: COLOR.textMuted } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
}

function buildEmployeesSheet(wb: ExcelJS.Workbook, employees: Employee[], sheetNames: Map<string, string>) {
  const ws = wb.addWorksheet(EMPLOYEES_SHEET, { views: [{ showGridLines: true, state: 'frozen', ySplit: 1 }] });
  setColumnWidths(ws, [14, 28, 22, 22, 18, 24, 16, 14]);

  const headers = ['Employee #', 'Name', 'Department', 'Position', 'Employment Type', 'Status', 'Date Hired', 'View Details'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(1, i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: COLOR.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.banner } };
    cell.border = allBorders;
  });
  ws.getRow(1).height = 20;

  employees.forEach((e, idx) => {
    const row = idx + 2;
    const shaded = idx % 2 === 1;
    const values: (string | number)[] = [e.employeeNumber, e.displayName, e.department || '', e.position || '', e.employmentType || '', statusLabel(e), e.dateHired || ''];
    values.forEach((v, c) => {
      const cell = ws.getCell(row, c + 1);
      cell.value = v === '' ? '—' : v;
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLOR.textDark } };
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      if (shaded) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fieldAltBg } };
      cell.border = allBorders;
    });
    const linkCell = ws.getCell(row, 8);
    linkCell.value = { text: 'View →', hyperlink: internalLink(sheetNames.get(e.id)!) };
    linkCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLOR.banner } };
    linkCell.alignment = { vertical: 'middle', horizontal: 'center' };
    linkCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.fieldBg } };
    linkCell.border = allBorders;
    ws.getRow(row).height = 18;
  });

  // AutoFilter on the header row — lets Excel/Sheets users search & filter
  // by any column (Employee #, Name, Department, Status, etc.) using the
  // dropdown arrows, without needing a separate search box.
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(employees.length + 1, 1), column: headers.length },
  };
}

async function buildEmployeeSheet(wb: ExcelJS.Workbook, employee: Employee, sheetName: string) {
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
  setColumnWidths(ws, [16, 16, 16, 16, 18, 18]);
  const p = employee.pds;
  let row = 1;

  // Back-to-list link
  const backCell = ws.getCell(row, 1);
  ws.mergeCells(row, 1, row, 3);
  backCell.value = { text: '← Back to Employee List', hyperlink: internalLink(EMPLOYEES_SHEET) };
  backCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: COLOR.banner } };
  backCell.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.getRow(row).height = 16;
  row += 1;

  // Banner: name + title
  bannerRow(ws, row, employee.displayName, { size: 16, bold: true, fill: COLOR.banner, height: 26 });
  row += 1;
  bannerRow(ws, row, `${employee.position || 'No position on file'}  ·  ${employee.department || 'No department on file'}`, { size: 10.5, bold: false, fill: COLOR.bannerSub, height: 18 });
  row += 1;

  // Photo block (rows row..row+5, column A only) with fields to the right
  const photoTopRow = row;
  const photoRowSpan = 6;
  ws.mergeCells(photoTopRow, 1, photoTopRow + photoRowSpan - 1, 1);
  const photoCell = ws.getCell(photoTopRow, 1);
  photoCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  photoCell.font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: COLOR.textMuted } };
  photoCell.border = allBorders;

  let photoEmbedded = false;
  if (employee.photoUrl) {
    const photo = await loadPhotoAsBase64(employee.photoUrl);
    if (photo) {
      const imageId = wb.addImage({ base64: photo.base64, extension: photo.extension });
      ws.addImage(imageId, { tl: { col: 0.08, row: photoTopRow - 1 + 0.1 }, ext: { width: 100, height: 100 }, editAs: 'oneCell' });
      photoEmbedded = true;
    }
  }
  if (!photoEmbedded) photoCell.value = 'No photo\non file';

  fieldRow(ws, photoTopRow, 'Employee ID:', employee.employeeNumber);
  fieldRow(ws, photoTopRow + 1, 'Contact #:', employee.contact || p.mobileNo);
  fieldRow(ws, photoTopRow + 2, 'Email Address:', employee.email);
  fieldRow(ws, photoTopRow + 3, 'Address:', employee.address);
  fieldRow(ws, photoTopRow + 4, 'Civil Status:', employee.civilStatus);
  fieldRow(ws, photoTopRow + 5, 'Date of Birth:', employee.dob);
  row = photoTopRow + photoRowSpan;
  row += 1; // spacer

  sectionBar(ws, row, 'Personal Information');
  row += 1;
  const personalFields: [string, string | number | null | undefined][] = [
    ['Sex at Birth', p.sexAtBirth],
    ['Nationality', employee.nationality],
    ['Place of Birth', p.placeOfBirth],
    ['Height (m)', p.heightM],
    ['Weight (kg)', p.weightKg],
    ['Blood Type', p.bloodType],
    ['Telephone No.', p.telephoneNo],
  ];
  personalFields.forEach(([label, value]) => {
    fieldRow(ws, row, `${label}:`, value);
    row += 1;
  });
  row += 1;

  sectionBar(ws, row, 'Employment Details');
  row += 1;
  const employmentFields: [string, string | number | null | undefined][] = [
    ['Employment Type', employee.employmentType],
    ['Employment Status', employee.employmentStatus],
    ['Date Hired', employee.dateHired],
    ['Contract Start', employee.contractStart],
    ['Contract End', employee.contractEnd],
    ['Immediate Supervisor', employee.supervisor],
    ['Record Status', statusLabel(employee)],
  ];
  employmentFields.forEach(([label, value]) => {
    fieldRow(ws, row, `${label}:`, value);
    row += 1;
  });
  row += 1;

  sectionBar(ws, row, 'Government Membership IDs');
  row += 1;
  const govFields: [string, string | number | null | undefined][] = [
    ['GSIS / UMID ID No.', p.gsisUmidNo],
    ['Pag-IBIG ID No.', p.pagibigNo],
    ['PhilHealth No.', p.philhealthNo],
    ['PhilSys Number (PSN)', p.philsysNumber],
    ['TIN No.', p.tinNo],
    ['Agency Employee No.', p.agencyEmployeeNo],
  ];
  govFields.forEach(([label, value]) => {
    fieldRow(ws, row, `${label}:`, value);
    row += 1;
  });
  row += 1;

  const table = (title: string, headers: string[], records: (string | number)[][], emptyMessage: string) => {
    sectionBar(ws, row, title);
    row += 1;
    if (records.length === 0) {
      emptyNote(ws, row, emptyMessage);
      row += 1;
      return;
    }
    tableHeaderRow(ws, row, headers);
    row += 1;
    records.forEach((r, i) => {
      tableDataRow(ws, row, r, i % 2 === 1);
      row += 1;
    });
  };

  table(
    'Education',
    ['Level', 'School / Institution', 'Degree / Course', 'Year Graduated', 'Honors'],
    employee.education.map((e) => [e.level || '', e.schoolName, e.degree || '', e.yearGraduated || '', e.honors || '']),
    'No education records on file.'
  );
  row += 1;

  table(
    'Work Experience',
    ['Company / Employer', 'Position', 'From', 'To', 'Status of Appointment'],
    employee.workExperience.map((w) => [w.company, w.position || '', w.fromDate || '', w.toDate || 'Present', w.statusOfAppointment || '']),
    'No work experience records on file.'
  );
  row += 1;

  table(
    'Training & Development',
    ['Course / Training Title', 'Provider', 'From', 'To / Completed', 'Hours', 'Certificate'],
    employee.training.map((t) => [t.course, t.provider || '', t.fromDate || '', t.completed || '', t.hours || '', t.certStatus === 'on-file' ? 'On file' : 'Expiring soon']),
    'No training records on file.'
  );
  row += 1;

  table(
    'Performance Reviews',
    ['Review Period', 'Rating', 'Reviewed By', 'Remarks'],
    employee.performance.map((r) => [r.period, r.rating || '', r.reviewer || '', r.remarks || '']),
    'No performance reviews on file.'
  );
  row += 1;

  table(
    'Attendance',
    ['Period', 'Days Present', 'Days Absent', 'Days Late', 'Remarks'],
    employee.attendance.map((a) => [a.period, a.daysPresent ?? '', a.daysAbsent ?? '', a.daysLate ?? '', a.remarks || '']),
    'No attendance records on file.'
  );
  row += 1;

  table(
    'Documents on File',
    ['Document', 'Status', 'Uploaded'],
    employee.documents.map((d) => [d.name, d.status === 'uploaded' ? 'Uploaded' : 'Missing', d.uploaded || '']),
    'No documents on file.'
  );
}

/**
 * Builds and downloads a styled "Employee 201 File" workbook (.xlsx): an
 * "Employees" sheet listing everyone with a "View Details" link per row,
 * and one profile-card-style detail sheet per employee (photo, banner
 * header, labeled fields, and record tables) with a link back to the list.
 */
export async function exportEmployeeWorkbook(employees: Employee[], filename = 'employee-201-file-workbook.xlsx'): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '201 File System';
  wb.created = new Date();

  const used = new Set<string>([EMPLOYEES_SHEET.toLowerCase()]);
  const sheetNames = new Map<string, string>();
  employees.forEach((e) => {
    sheetNames.set(e.id, uniqueSheetName(`${e.employeeNumber} ${e.displayName}`, used));
  });

  buildEmployeesSheet(wb, employees, sheetNames);
  for (const e of employees) {
    await buildEmployeeSheet(wb, e, sheetNames.get(e.id)!);
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer as unknown as ArrayBuffer | Uint8Array, filename);
}
