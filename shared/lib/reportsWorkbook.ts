// Styled Excel exports for the Employee List Report and Document Status
// Report — same wine/maroon theme, borders, and column sizing as the
// Employee 201 File Workbook (see xlsxTheme.ts and employeeWorkbook.ts),
// so every report generated from the Reports page looks consistent.

import ExcelJS from 'exceljs';
import type { Employee } from '@/shared/types';
import { titleBanner, headerRow, dataRow, setColumnWidths, downloadWorkbookBuffer } from '@/shared/lib/xlsxTheme';

function todayLabel(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Builds and downloads the Employee List Report (.xlsx): every employee's
 * number, department, position, hire date, status, and contract dates.
 */
export async function exportEmployeeListReport(employees: Employee[], filename = 'employee-list-report.xlsx'): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '201 File System';
  wb.created = new Date();

  const headers = ['Employee #', 'Name', 'Department', 'Position', 'Date Hired', 'Status', 'Contract Start', 'Contract End'];
  const widths = [14, 26, 22, 22, 14, 16, 14, 14];

  const ws = wb.addWorksheet('Employee List', { views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }] });
  setColumnWidths(ws, widths);

  titleBanner(ws, 1, headers.length, `Employee List Report — Generated ${todayLabel()}`);
  ws.getRow(2).height = 6; // spacer
  headerRow(ws, 3, headers);

  employees.forEach((e, idx) => {
    const row = 4 + idx;
    const contractEnd = e.employmentStatus === 'Regular' ? 'N/A' : (e.contractEnd || '');
    dataRow(
      ws,
      row,
      [e.employeeNumber, e.displayName, e.department || '', e.position || '', e.dateHired || '', e.employmentStatus || '', e.contractStart || '', contractEnd],
      idx % 2 === 1
    );
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(employees.length + 3, 3), column: headers.length } };

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer as unknown as ArrayBuffer | Uint8Array, filename);
}

/**
 * Builds and downloads the Document Status Report (.xlsx): every required
 * document per employee, with upload status.
 */
export async function exportDocumentStatusReport(employees: Employee[], filename = 'document-status-report.xlsx'): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = '201 File System';
  wb.created = new Date();

  const headers = ['Employee #', 'Name', 'Document', 'Status', 'Uploaded'];
  const widths = [14, 26, 30, 14, 16];

  const ws = wb.addWorksheet('Document Status', { views: [{ showGridLines: true, state: 'frozen', ySplit: 3 }] });
  setColumnWidths(ws, widths);

  titleBanner(ws, 1, headers.length, `Document Status Report — Generated ${todayLabel()}`);
  ws.getRow(2).height = 6; // spacer
  headerRow(ws, 3, headers);

  let row = 4;
  let shadeIdx = 0;
  employees.forEach((e) => {
    e.documents.forEach((d) => {
      dataRow(ws, row, [e.employeeNumber, e.displayName, d.name, d.status === 'uploaded' ? 'Uploaded' : 'Missing', d.uploaded || '—'], shadeIdx % 2 === 1);
      row += 1;
      shadeIdx += 1;
    });
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: Math.max(row - 1, 3), column: headers.length } };

  const buffer = await wb.xlsx.writeBuffer();
  downloadWorkbookBuffer(buffer as unknown as ArrayBuffer | Uint8Array, filename);
}
