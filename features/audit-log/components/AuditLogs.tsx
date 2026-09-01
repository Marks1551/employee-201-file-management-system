'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { inputCls } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import { useApp } from '@/shared/context/AppContext';
import { usePagination } from '@/shared/lib/usePagination';

export default function AuditLogs() {
  const { auditLog } = useApp();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return auditLog;
    return auditLog.filter((row) => (row.who || '').toLowerCase().includes(q) || (row.action || '').toLowerCase().includes(q) || (row.role || '').toLowerCase().includes(q));
  }, [auditLog, query]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(filtered, 15);

  return (
    <Layout role="admin" eyebrow="Admin › Audit" title="Audit Logs">
      <p className="text-ink-muted mb-5">A plain-language history of every account and record action, most recent first.</p>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="relative">
          <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            placeholder="Search by name, role, or action"
            aria-label="Search audit logs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={`${inputCls} pl-11`}
          />
        </div>
      </div>

      <TableWrap>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              <Th>Who</Th>
              <Th>Action</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr key={row.id} className="hover:bg-[#FBFAF7]">
                <Td>
                  <CellName>{row.who}</CellName>
                  {row.role !== 'System' && <CellSub>{row.role}</CellSub>}
                </Td>
                <Td>{row.action}</Td>
                <Td className="whitespace-nowrap">{row.when}</Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={3} className="text-ink-faint">No matching activity.</Td>
              </tr>
            )}
          </tbody>
        </table>
      </TableWrap>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={filtered.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemLabel="logged actions"
      />
    </Layout>
  );
}
