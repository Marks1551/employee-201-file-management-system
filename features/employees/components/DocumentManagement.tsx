'use client';

import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Search, Eye } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { inputCls, Tag, Button, Field } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import Modal from '@/shared/components/Modal';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { usePagination } from '@/shared/lib/usePagination';
import type { DocumentRecord } from '@/shared/types';

interface DocumentRow extends DocumentRecord {
  empId: string;
  empName: string;
  empNumber: string;
}

export default function DocumentManagement() {
  const { employees, uploadDocument, approveDocument, rejectDocument } = useApp();
  const showToast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRow = useRef<DocumentRow | null>(null);
  const [rejectRow, setRejectRow] = useState<DocumentRow | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectBusy, setRejectBusy] = useState(false);

  const rows = useMemo(() => {
    const list: DocumentRow[] = [];
    employees.forEach((emp) => {
      emp.documents.forEach((doc) => {
        list.push({ empId: emp.id, empName: emp.displayName, empNumber: emp.employeeNumber, ...doc });
      });
    });
    return list;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery = !q || r.empName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, statusFilter]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(filtered, 10);

  function handleUploadClick(row: DocumentRow) {
    pendingRow.current = row;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const row = pendingRow.current;
    pendingRow.current = null;
    if (!file || !row) return;
    const key = `${row.empId}-${row.id}`;
    setBusyKey(key);
    const result = await uploadDocument(row.empId, row.id, file);
    setBusyKey(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Uploaded "${row.name}" for ${row.empName}.`);
  }

  async function handleApprove(row: DocumentRow) {
    const key = `${row.empId}-${row.id}`;
    setBusyKey(key);
    const result = await approveDocument(row.empId, row.id);
    setBusyKey(null);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Approved "${row.name}" for ${row.empName}.`);
  }

  function openReject(row: DocumentRow) {
    setRejectRow(row);
    setRejectNote('');
  }

  function closeReject() {
    setRejectRow(null);
    setRejectNote('');
  }

  async function handleConfirmReject() {
    if (!rejectRow) return;
    setRejectBusy(true);
    const result = await rejectDocument(rejectRow.empId, rejectRow.id, rejectNote);
    setRejectBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`Rejected "${rejectRow.name}" for ${rejectRow.empName}.`);
    closeReject();
  }

  const missingTotal = rows.filter((r) => r.status === 'missing').length;
  const pendingTotal = rows.filter((r) => r.status === 'pending').length;

  return (
    <Layout role="hr" eyebrow="HR › Documents" title="Document Management">
      <p className="text-ink-muted mb-5">{rows.length} documents tracked across {employees.length} employees. {missingTotal} are still missing{pendingTotal > 0 ? `, ${pendingTotal} awaiting your review` : ''}.</p>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="grid gap-4 md:grid-cols-2 items-end">
          <div className="relative">
            <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              placeholder="Search by employee or document"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${inputCls} pl-11`}
            />
          </div>
          <select className={inputCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="uploaded">Uploaded</option>
            <option value="pending">Pending Review</option>
            <option value="rejected">Rejected</option>
            <option value="missing">Missing</option>
          </select>
        </div>
      </div>

      <TableWrap>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Document</Th>
              <Th>Status</Th>
              <Th>Uploaded</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={`${r.empId}-${r.id}`} className="hover:bg-[#FBFAF7]">
                <Td>
                  <CellName>{r.empName}</CellName>
                  <CellSub>Employee #{r.empNumber}</CellSub>
                </Td>
                <Td>{r.name}</Td>
                <Td>
                  {r.status === 'uploaded' && <Tag kind="ok">Uploaded</Tag>}
                  {r.status === 'pending' && <Tag kind="warn">Pending Review</Tag>}
                  {r.status === 'rejected' && <Tag kind="danger">Rejected</Tag>}
                  {r.status === 'missing' && <Tag kind="danger">Missing</Tag>}
                </Td>
                <Td>{r.uploaded || '—'}</Td>
                <Td>
                  {r.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      {r.pendingFileUrl && (
                        <a href={r.pendingFileUrl} target="_blank" rel="noopener noreferrer" className="text-navy font-semibold text-[0.86rem] no-underline hover:underline inline-flex items-center gap-1">
                          <Eye size={14} />Preview
                        </a>
                      )}
                      <Button
                        sm
                        variant="primary"
                        onClick={() => handleApprove(r)}
                        disabled={busyKey === `${r.empId}-${r.id}`}
                      >
                        {busyKey === `${r.empId}-${r.id}` ? 'Approving…' : 'Approve'}
                      </Button>
                      <Button sm variant="danger" onClick={() => openReject(r)} disabled={busyKey === `${r.empId}-${r.id}`}>
                        Reject
                      </Button>
                    </div>
                  ) : r.status === 'missing' || r.status === 'rejected' ? (
                    <Button
                      sm
                      variant="secondary"
                      onClick={() => handleUploadClick(r)}
                      disabled={busyKey === `${r.empId}-${r.id}`}
                    >
                      {busyKey === `${r.empId}-${r.id}` ? 'Uploading…' : 'Upload'}
                    </Button>
                  ) : (
                    <Link href={`/hr/employees/${r.empId}`} className="text-navy font-semibold text-[0.86rem] no-underline hover:underline">
                      View file
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><Td colSpan={5} className="text-ink-faint">No documents match your filters.</Td></tr>
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
        itemLabel="documents"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Modal open={!!rejectRow} onClose={closeReject} title={rejectRow ? `Reject "${rejectRow.name}"` : ''}>
        <p className="text-[0.86rem] text-ink-muted mb-4">
          The file {rejectRow?.empName} submitted will be discarded and never applied to their 201 file. They'll see this document as rejected and can resubmit.
        </p>
        <Field label="Reason (optional)" htmlFor="dmRejectNote" hint="Shown to faculty so they know what to fix.">
          <textarea
            id="dmRejectNote"
            className={inputCls}
            rows={3}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. Image is blurry, please re-scan and resubmit."
          />
        </Field>
        <div className="flex gap-3 mt-4">
          <Button variant="secondary" className="flex-1" onClick={closeReject}>Cancel</Button>
          <Button variant="danger" className="flex-1" onClick={handleConfirmReject} disabled={rejectBusy}>
            {rejectBusy ? 'Rejecting…' : 'Reject Document'}
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
