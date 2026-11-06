"use client";

import { useMemo, useState } from "react";
import { FileBarChart, Download, FileSpreadsheet, Filter } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Card, Button } from "@/shared/components/ui";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { exportEmployeeWorkbook } from "@/shared/lib/employeeWorkbook";
import { exportEmployeeListReport } from "@/shared/lib/reportsWorkbook";
import { useDepartments } from "@/shared/lib/useDepartments";

const NO_DEPARTMENT = "(No department)";

/** "Computer Science" -> "computer-science", for file names. */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function Reports() {
  const { employees, currentUser, logAction } = useApp();
  const showToast = useToast();
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const { departments } = useDepartments();
  // Departments ticked for the report. Empty = every department.
  const [selected, setSelected] = useState<string[]>([]);

  // Every department HR has set up, plus any an employee still has that isn't in that list.
  const options = useMemo(() => {
    const names = [...departments];
    employees.forEach((e) => {
      const d = e.department || NO_DEPARTMENT;
      if (!names.includes(d)) names.push(d);
    });
    return names
      .map((name) => ({ name, count: employees.filter((e) => (e.department || NO_DEPARTMENT) === name).length }))
      .filter((o) => o.count > 0 || departments.includes(o.name));
  }, [departments, employees]);

  // Keeps the first of any duplicates and drops the later ones: repeated employees (same
  // employee number) and repeated documents under one employee (same document name).
  const filtered = useMemo(() => {
    const scoped = selected.length
      ? employees.filter((e) => selected.includes(e.department || NO_DEPARTMENT))
      : employees;
    const seenEmployees = new Set<string>();
    const unique: typeof scoped = [];
    scoped.forEach((e) => {
      const key = (e.employeeNumber || "").trim().toLowerCase();
      if (key) {
        if (seenEmployees.has(key)) return;
        seenEmployees.add(key);
      }
      const seenDocs = new Set<string>();
      const documents = e.documents.filter((d) => {
        const docKey = d.name.trim().toLowerCase();
        if (seenDocs.has(docKey)) return false;
        seenDocs.add(docKey);
        return true;
      });
      unique.push({ ...e, documents });
    });
    return unique;
  }, [employees, selected]);
  const scopeLabel = selected.length ? selected.join(", ") : "";
  const fileSuffix = selected.length ? `-${selected.map(slug).join("-")}`.slice(0, 80) : "";
  const logScope = selected.length ? ` (${scopeLabel})` : "";

  function toggle(name: string) {
    setSelected((cur) => (cur.includes(name) ? cur.filter((d) => d !== name) : [...cur, name]));
  }

  async function generateEmployeeList() {
    await exportEmployeeListReport(filtered, `employee-list-report${fileSuffix}.xlsx`, scopeLabel);
    setLastGenerated(`Employee List Report${logScope}`);
    if (currentUser) logAction(currentUser.name, "HR Personnel", `Generated the Employee List Report${logScope}`);
    showToast("Employee List Report downloaded.");
  }

  async function generateEmployeeWorkbook() {
    showToast("Building the workbook…");
    await exportEmployeeWorkbook(filtered, `employee-201-file-workbook${fileSuffix}.xlsx`);
    setLastGenerated(`Employee 201 File Workbook${logScope}`);
    if (currentUser) logAction(currentUser.name, "HR Personnel", `Generated the Employee 201 File Workbook${logScope}`);
    showToast("Employee 201 File Workbook downloaded.");
  }

  return (
    <Layout role="hr" eyebrow="HR › Reports" title="Generate Reports">
      <p className="text-ink-muted mb-6">Create a report and download it as a styled Excel file.</p>

      <Card className="mb-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-navy" />
            <h3 className="m-0 text-[1rem]">Filter by department</h3>
          </div>
          <p className="m-0 text-[0.86rem] text-ink-muted">
            {filtered.length} of {employees.length} employee{employees.length === 1 ? "" : "s"} will be included
          </p>
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Departments to include in the reports">
          <button
            type="button"
            onClick={() => setSelected([])}
            aria-pressed={selected.length === 0}
            className={`inline-flex items-center gap-2 min-h-[38px] px-4 rounded-full font-semibold text-[0.86rem] border-[1.5px] cursor-pointer transition-colors ${
              selected.length === 0
                ? "bg-navy text-white border-navy"
                : "bg-white text-navy border-border-strong hover:bg-navy-100"
            }`}
          >
            All departments
            <span
              className={`text-[0.76rem] px-2 py-0.5 rounded-full ${selected.length === 0 ? "bg-white/20 text-white" : "bg-navy-100 text-navy"}`}
            >
              {employees.length}
            </span>
          </button>
          {options.map((o) => {
            const active = selected.includes(o.name);
            return (
              <button
                key={o.name}
                type="button"
                onClick={() => toggle(o.name)}
                aria-pressed={active}
                className={`inline-flex items-center gap-2 min-h-[38px] px-4 rounded-full font-semibold text-[0.86rem] border-[1.5px] cursor-pointer transition-colors ${
                  active
                    ? "bg-navy text-white border-navy"
                    : "bg-white text-navy border-border-strong hover:bg-navy-100"
                }`}
              >
                {o.name}
                <span
                  className={`text-[0.76rem] px-2 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-navy-100 text-navy"}`}
                >
                  {o.count}
                </span>
              </button>
            );
          })}
        </div>
        <p className="m-0 mt-2.5 text-[0.8rem] text-ink-faint">
          Pick one or more departments. This applies to both reports below.
        </p>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <div className="w-12 h-12 rounded-2xl bg-navy-100 text-navy flex items-center justify-center mb-3.5">
            <FileBarChart size={24} />
          </div>
          <h3 className="mb-1">Employee List Report</h3>
          <p className="text-ink-muted text-[0.9rem] flex-1">
            Every employee's number, department, position, and hire date (for the departments selected above).
          </p>
          <Button onClick={generateEmployeeList} disabled={filtered.length === 0} className="mt-3">
            <Download size={18} />
            Download Excel
          </Button>
        </Card>

        <Card className="flex flex-col">
          <div className="w-12 h-12 rounded-2xl bg-navy-100 text-navy flex items-center justify-center mb-3.5">
            <FileSpreadsheet size={24} />
          </div>
          <h3 className="mb-1">Employee 201 File Workbook</h3>
          <p className="text-ink-muted text-[0.9rem] flex-1">
            One Excel workbook with all employees listed — click "View PDS →" next to any name to open that employee's
            actual Personal Data Sheet (CS Form No. 212, Revised 2026), filled in with their records, with a link back
            to the list.
          </p>
          <Button onClick={generateEmployeeWorkbook} disabled={filtered.length === 0} className="mt-3">
            <Download size={18} />
            Download Excel
          </Button>
        </Card>
      </div>

      {lastGenerated && <p className="text-ink-faint text-[0.86rem] mt-5">Last generated: {lastGenerated}.</p>}
    </Layout>
  );
}
