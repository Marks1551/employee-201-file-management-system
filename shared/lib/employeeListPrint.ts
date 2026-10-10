import type { Employee } from "@/shared/types";
import { documentCompletion } from "./documentCompletion";
import { printHtmlDocument } from "./printDocument";

const esc = (v: string | null | undefined): string =>
  (v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Prints the employee records currently shown in the list (already filtered by department,
 *  status and search), one row per employee, headed with the department. */
export function printEmployeeRecords(
  employees: Employee[],
  opts: { department: string; status: string; search: string },
) {
  const deptLabel = opts.department === "All departments" ? "All Departments" : opts.department;
  const filters = [
    `Department: ${deptLabel}`,
    opts.status !== "all" ? `Status: ${opts.status === "active" ? "Active" : "Inactive"}` : null,
    opts.search.trim() ? `Search: “${opts.search.trim()}”` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const generatedOn = new Date().toLocaleString("en-PH", { dateStyle: "long", timeStyle: "short" });

  const rows = employees
    .map((e, i) => {
      const { missingCount, rejectedCount, isComplete } = documentCompletion(e.documents);
      const docs = isComplete
        ? "Complete"
        : rejectedCount > 0
          ? `${rejectedCount} rejected`
          : `${missingCount} missing`;
      return `<tr>
        <td class="n">${i + 1}</td>
        <td>${esc(e.employeeNumber)}</td>
        <td><strong>${esc(e.fullName || e.displayName)}</strong></td>
        <td>${esc(e.department)}</td>
        <td>${esc(e.position)}</td>
        <td>${esc(e.employmentStatus as string)}</td>
        <td>${esc(e.dateHired)}</td>
        <td>${esc(e.contact)}</td>
        <td>${(e.status || "active") === "active" ? "Active" : "Inactive"}</td>
        <td>${esc(docs)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Employee Records — ${esc(deptLabel)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10px; margin: 0; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .meta { color: #555; font-size: 10px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #444; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #eee; font-size: 9px; text-transform: uppercase; letter-spacing: .03em; }
  td.n { width: 22px; text-align: center; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .foot { margin-top: 10px; color: #666; font-size: 9px; }
</style></head><body>
  <h1>Employee Records — ${esc(deptLabel)}</h1>
  <div class="meta">${esc(filters)}  ·  ${employees.length} employee${employees.length === 1 ? "" : "s"}  ·  Generated ${esc(generatedOn)}</div>
  <table>
    <thead><tr>
      <th>#</th><th>Employee No.</th><th>Name</th><th>Department</th><th>Position</th>
      <th>Employment</th><th>Date Hired</th><th>Contact</th><th>Record</th><th>Documents</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="10" style="text-align:center;padding:16px">No employees match these filters.</td></tr>`}</tbody>
  </table>
  <div class="foot">Confidential — HR Employee 201 File Management System</div>
</body></html>`;
  printHtmlDocument(html);
}
