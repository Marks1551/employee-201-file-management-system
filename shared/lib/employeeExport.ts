// Generates a printable "Employee 201 File" summary — everything on file
// for one employee (personal & employment info, government benefit numbers,
// education, work experience, training, performance, attendance, and
// documents) in one document. This is separate from `exportPds`, which
// renders the official CS Form No. 212 Personal Data Sheet layout; this
// export is a plain summary of the employee record itself.

import type { Employee } from '@/shared/types';

function esc(value: string | number | null | undefined): string {
  const str = value === null || value === undefined || value === '' ? '' : String(value);
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function dash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? '—' : esc(value);
}

function field(label: string, value: string | number | null | undefined): string {
  return `<div class="f"><span class="lbl">${esc(label)}</span><span class="val">${dash(value)}</span></div>`;
}

function table(headers: string[], rows: string[][], emptyMessage: string): string {
  if (rows.length === 0) {
    return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody><tr><td class="empty" colspan="${headers.length}">${esc(emptyMessage)}</td></tr></tbody></table>`;
  }
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${c || '&nbsp;'}</td>`).join('')}</tr>`).join('');
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
}

function buildHtml(employee: Employee): string {
  const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const p = employee.pds;
  const statusLabel = (employee.status || 'active') === 'active'
    ? 'Active'
    : `Inactive — ${employee.deactivationReason || 'n/a'}${employee.deactivatedAt ? ` (${employee.deactivatedAt})` : ''}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Employee 201 File — ${esc(employee.displayName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; font-size: 11px; }
  .page { padding: 26px 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2a44; padding-bottom: 10px; margin-bottom: 14px; }
  .title { font-weight: 700; font-size: 1.3rem; margin: 0 0 2px; color: #1f2a44; }
  .subtitle { font-size: 10px; color: #555; margin: 0; }
  .status { font-size: 9.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #eef1f7; color: #1f2a44; white-space: nowrap; }
  .section-h {
    background: #1f2a44; color: #fff; font-weight: 700; font-size: 10px; letter-spacing: 0.04em;
    padding: 5px 9px; margin: 16px 0 8px; text-transform: uppercase;
  }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 16px; }
  .f { display: flex; flex-direction: column; padding: 4px 0; border-bottom: 1px dotted #ddd; }
  .lbl { font-size: 8px; color: #666; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 2px; }
  .val { font-size: 10.5px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5px; margin-bottom: 4px; }
  th, td { border: 1px solid #ccc; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #f0f1f4; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.02em; }
  td.empty { color: #999; font-style: italic; text-align: center; }
  .page-footer { margin-top: 22px; font-size: 8px; color: #888; text-align: center; }
  @media print { .page { padding: 16px 22px; } .section-h { break-after: avoid; } table { break-inside: avoid; } }
</style>
</head>
<body>

<div class="page">
  <div class="header">
    <div>
      <p class="title">${esc(employee.displayName)}</p>
      <p class="subtitle">${esc(employee.position) || 'No position on file'} · ${esc(employee.department) || 'No department on file'} · Employee #${esc(employee.employeeNumber)}</p>
    </div>
    <span class="status">${esc(statusLabel)}</span>
  </div>

  <div class="section-h">Personal Information</div>
  <div class="grid">
    ${field('Full Name', employee.fullName)}
    ${field('Date of Birth', employee.dob)}
    ${field('Sex at Birth', p.sexAtBirth)}
    ${field('Civil Status', employee.civilStatus)}
    ${field('Nationality', employee.nationality)}
    ${field('Place of Birth', p.placeOfBirth)}
    ${field('Height (m)', p.heightM)}
    ${field('Weight (kg)', p.weightKg)}
    ${field('Blood Type', p.bloodType)}
    ${field('Contact Number', employee.contact)}
    ${field('Mobile No.', p.mobileNo)}
    ${field('Telephone No.', p.telephoneNo)}
    ${field('Email Address', employee.email)}
    ${field('Address', employee.address)}
  </div>

  <div class="section-h">Employment Information</div>
  <div class="grid">
    ${field('Employee Number', employee.employeeNumber)}
    ${field('Department', employee.department)}
    ${field('Position', employee.position)}
    ${field('Employment Type', employee.employmentType)}
    ${field('Employment Status', employee.employmentStatus)}
    ${field('Date Hired', employee.dateHired)}
    ${field('Contract Start', employee.contractStart)}
    ${field('Contract End', employee.contractEnd)}
    ${field('Immediate Supervisor', employee.supervisor)}
    ${field('Record Status', statusLabel)}
  </div>

  <div class="section-h">Government Membership IDs</div>
  <div class="grid">
    ${field('GSIS / UMID ID No.', p.gsisUmidNo)}
    ${field('Pag-IBIG ID No.', p.pagibigNo)}
    ${field('PhilHealth No.', p.philhealthNo)}
    ${field('PhilSys Number (PSN)', p.philsysNumber)}
    ${field('TIN No.', p.tinNo)}
    ${field('Agency Employee No.', p.agencyEmployeeNo)}
  </div>

  <div class="section-h">Education</div>
  ${table(
    ['Level', 'School / Institution', 'Degree / Course', 'Year Graduated', 'Honors'],
    employee.education.map((e) => [esc(e.level), esc(e.schoolName), esc(e.degree), esc(e.yearGraduated), esc(e.honors)]),
    'No education records on file.'
  )}

  <div class="section-h">Work Experience</div>
  ${table(
    ['Company / Employer', 'Position', 'From', 'To', 'Status of Appointment'],
    employee.workExperience.map((w) => [esc(w.company), esc(w.position), esc(w.fromDate), esc(w.toDate) || 'Present', esc(w.statusOfAppointment)]),
    'No work experience records on file.'
  )}

  <div class="section-h">Training &amp; Development</div>
  ${table(
    ['Course / Training Title', 'Provider', 'From', 'To / Completed', 'Hours', 'Certificate'],
    employee.training.map((t) => [esc(t.course), esc(t.provider), esc(t.fromDate), esc(t.completed), esc(t.hours), t.certStatus === 'on-file' ? 'On file' : 'Expiring soon']),
    'No training records on file.'
  )}

  <div class="section-h">Performance Reviews</div>
  ${table(
    ['Review Period', 'Rating', 'Reviewed By', 'Remarks'],
    employee.performance.map((r) => [esc(r.period), esc(r.rating), esc(r.reviewer), esc(r.remarks)]),
    'No performance reviews on file.'
  )}

  <div class="section-h">Attendance</div>
  ${table(
    ['Period', 'Days Present', 'Days Absent', 'Days Late', 'Remarks'],
    employee.attendance.map((a) => [esc(a.period), dash(a.daysPresent), dash(a.daysAbsent), dash(a.daysLate), esc(a.remarks)]),
    'No attendance records on file.'
  )}

  <div class="section-h">Documents on File</div>
  ${table(
    ['Document', 'Status', 'Uploaded'],
    employee.documents.map((d) => [esc(d.name), d.status === 'uploaded' ? 'Uploaded' : 'Missing', esc(d.uploaded)]),
    'No documents on file.'
  )}

  <p class="page-footer">Employee 201 File Summary — Employee #${esc(employee.employeeNumber)} — ${esc(employee.displayName)} &nbsp;·&nbsp; Generated ${esc(generatedOn)}</p>
</div>

</body>
</html>`;
}

/**
 * Opens a new tab with a print-ready summary of everything on file for one
 * employee (personal & employment info, government IDs, education, work
 * experience, training, performance, attendance, documents) and triggers
 * the browser print dialog, letting the user save it as a PDF.
 */
export function exportEmployeeProfile(employee: Employee): void {
  const html = buildHtml(employee);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 300);
}
