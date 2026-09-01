'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Users, AlertTriangle, FolderOpen, Search, FileBarChart, FileText } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { StatCard, ActionTile, Tag } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import { useApp } from '@/shared/context/AppContext';
import { documentCompletion } from '@/shared/lib/documentCompletion';
import type { Employee } from '@/shared/types';

export default function HRDashboard() {
  const { currentUser, employees } = useApp();

  const incomplete = useMemo(() => employees.filter((e) => !documentCompletion(e.documents).isComplete), [employees]);
  const missingCount = employees.reduce((acc, e) => acc + documentCompletion(e.documents).missingCount, 0);
  const rejectedCount = employees.reduce((acc, e) => acc + documentCompletion(e.documents).rejectedCount, 0);
  const recentlyUpdated = employees.slice(0, 4);

  function docStatusTag(emp: Employee) {
    const { missingCount: missingDocs, rejectedCount: rejectedDocs, isComplete } = documentCompletion(emp.documents);
    if (isComplete) return <Tag kind="ok">Complete</Tag>;
    const label = [
      missingDocs > 0 ? `${missingDocs} missing` : null,
      rejectedDocs > 0 ? `${rejectedDocs} rejected` : null,
    ]
      .filter(Boolean)
      .join(', ');
    return <Tag kind="danger">{label}</Tag>;
  }

  return (
    <Layout role="hr" eyebrow="HR Personnel" title="HR Dashboard">
      {incomplete.length > 0 && (
        <div className="flex gap-3 p-4 rounded-2xl border border-warn-border bg-warn-bg text-warn-text mb-5">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <strong className="block mb-0.5">{incomplete.length} employees have incomplete 201 files</strong>
            Missing documents or rejected submissions still need action.{' '}
            <Link href="/hr/documents" className="underline font-medium">View the list</Link>.
          </div>
        </div>
      )}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-8">
        <StatCard icon={Users} color="green" value={employees.length} label="Employee records" />
        <StatCard icon={AlertTriangle} color="gold" value={missingCount + rejectedCount} label="Missing / rejected documents" />
        <StatCard icon={FileText} color="navy" value={employees.reduce((a, e) => a + e.documents.filter((d) => d.status === 'uploaded').length, 0)} label="Documents on file" />
      </div>

      <div className="mb-8">
        <h2 className="mb-3.5">What would you like to do?</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ActionTile to="/hr/employees" icon={Users} iconBg="bg-hr-bg text-hr-text" title="Manage Employee Records" description="Add, update, or review employee 201 files." />
          <ActionTile to="/hr/documents" icon={FolderOpen} iconBg="bg-admin-bg text-admin-text" title="Manage Documents" description="Track which employee documents are complete." />
          <ActionTile to="/hr/search" icon={Search} iconBg="bg-faculty-bg text-faculty-text" title="Search Records" description="Find an employee's file by name, ID, or department." />
          <ActionTile to="/hr/reports" icon={FileBarChart} iconBg="bg-navy-100 text-navy" title="Generate Reports" description="Create employee list or document status reports." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
          <h2>Recently updated employees</h2>
          <Link href="/hr/employees" className="text-navy font-semibold text-[0.9rem] no-underline hover:underline">View all &rsaquo;</Link>
        </div>
        <TableWrap>
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th>Document Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {recentlyUpdated.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#FBFAF7]">
                  <Td>
                    <CellName>{emp.displayName}</CellName>
                    <CellSub>Employee #{emp.employeeNumber}</CellSub>
                  </Td>
                  <Td>{emp.department}</Td>
                  <Td>{docStatusTag(emp)}</Td>
                  <Td>
                    <Link href={`/hr/employees/${emp.id}`} className="inline-flex items-center justify-center min-h-[38px] px-3.5 rounded-lg font-semibold text-[0.86rem] bg-white text-navy border-[1.5px] border-border-strong hover:bg-navy-100 no-underline">
                      View 201 File
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Layout>
  );
}
