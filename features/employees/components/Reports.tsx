'use client';

import { useState } from 'react';
import { FileBarChart, Download, FileSpreadsheet } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { Card, Button } from '@/shared/components/ui';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { exportEmployeeWorkbook } from '@/shared/lib/employeeWorkbook';
import { exportEmployeeListReport, exportDocumentStatusReport } from '@/shared/lib/reportsWorkbook';

export default function Reports() {
  const { employees, currentUser, logAction } = useApp();
  const showToast = useToast();
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  async function generateEmployeeList() {
    await exportEmployeeListReport(employees);
    setLastGenerated('Employee List Report');
    if (currentUser) logAction(currentUser.name, 'HR Personnel', 'Generated the Employee List Report');
    showToast('Employee List Report downloaded.');
  }

  async function generateDocStatus() {
    await exportDocumentStatusReport(employees);
    setLastGenerated('Document Status Report');
    if (currentUser) logAction(currentUser.name, 'HR Personnel', 'Generated the Document Status Report');
    showToast('Document Status Report downloaded.');
  }

  async function generateEmployeeWorkbook() {
    showToast('Building the workbook…');
    await exportEmployeeWorkbook(employees);
    setLastGenerated('Employee 201 File Workbook');
    if (currentUser) logAction(currentUser.name, 'HR Personnel', 'Generated the Employee 201 File Workbook');
    showToast('Employee 201 File Workbook downloaded.');
  }

  return (
    <Layout role="hr" eyebrow="HR › Reports" title="Generate Reports">
      <p className="text-ink-muted mb-6">Create a report and download it as a styled Excel file.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <div className="w-12 h-12 rounded-2xl bg-navy-100 text-navy flex items-center justify-center mb-3.5">
            <FileBarChart size={24} />
          </div>
          <h3 className="mb-1">Employee List Report</h3>
          <p className="text-ink-muted text-[0.9rem] flex-1">Every employee's number, department, position, and hire date.</p>
          <Button onClick={generateEmployeeList} className="mt-3">
            <Download size={18} />
            Download Excel
          </Button>
        </Card>

        <Card className="flex flex-col">
          <div className="w-12 h-12 rounded-2xl bg-hr-bg text-hr-text flex items-center justify-center mb-3.5">
            <FileBarChart size={24} />
          </div>
          <h3 className="mb-1">Document Status Report</h3>
          <p className="text-ink-muted text-[0.9rem] flex-1">Every required document per employee, with upload status.</p>
          <Button onClick={generateDocStatus} className="mt-3">
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
            One Excel workbook with all employees listed — click "View →" next to any name to jump to that employee's full details on their own sheet, with a link back to the list.
          </p>
          <Button onClick={generateEmployeeWorkbook} className="mt-3">
            <Download size={18} />
            Download Excel
          </Button>
        </Card>
      </div>

      {lastGenerated && (
        <p className="text-ink-faint text-[0.86rem] mt-5">Last generated: {lastGenerated}.</p>
      )}
    </Layout>
  );
}
