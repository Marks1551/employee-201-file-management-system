'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { inputCls, Tag } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import { useApp } from '@/shared/context/AppContext';
import { usePagination } from '@/shared/lib/usePagination';
import type { Employee } from '@/shared/types';

export default function SearchRecords() {
  const { employees } = useApp();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return employees.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.employeeNumber.includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.position || '').toLowerCase().includes(q)
    );
  }, [employees, query]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(results, 10);

  function docStatusTag(emp: Employee) {
    const missing = emp.documents.filter((d) => d.status === 'missing').length;
    if (missing === 0) return <Tag kind="ok">Complete</Tag>;
    return <Tag kind={missing > 1 ? 'danger' : 'warn'}>{missing} missing</Tag>;
  }

  return (
    <Layout role="hr" eyebrow="HR › Search" title="Search Records">
      <p className="text-ink-muted mb-5">Find any employee by name, employee number, department, or position.</p>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="relative">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            autoFocus
            placeholder="Try “engineering”, “0142”, or a name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputCls} pl-11`}
          />
        </div>
      </div>

      {query.trim() === '' ? (
        <p className="text-ink-faint text-center py-10">Start typing to search across all employee records.</p>
      ) : (
        <TableWrap>
          <table className="w-full border-collapse min-w-[600px]">
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Department</Th>
                <Th>Position</Th>
                <Th>Document Status</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((emp) => (
                <tr key={emp.id} className="hover:bg-[#FBFAF7]">
                  <Td>
                    <CellName>{emp.displayName}</CellName>
                    <CellSub>Employee #{emp.employeeNumber}</CellSub>
                  </Td>
                  <Td>{emp.department}</Td>
                  <Td>{emp.position}</Td>
                  <Td>{docStatusTag(emp)}</Td>
                  <Td>
                    <Link href={`/hr/employees/${emp.id}`} className="text-navy font-semibold text-[0.86rem] no-underline hover:underline">
                      View 201 File
                    </Link>
                  </Td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr><Td colSpan={5} className="text-ink-faint">No employees match “{query}”.</Td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      )}
      {query.trim() !== '' && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={results.length}
          startIndex={startIndex}
          endIndex={endIndex}
          itemLabel="matching employees"
        />
      )}
    </Layout>
  );
}
