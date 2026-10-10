"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Search, Eye, FilePlus2, Trash2, ListChecks, ChevronDown } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { inputCls, Tag, Button, Field } from "@/shared/components/ui";
import { TableWrap, Th, Td, CellName, CellSub } from "@/shared/components/Table";
import TabMenu from "@/shared/components/TabMenu";
import Pagination from "@/shared/components/Pagination";
import Modal from "@/shared/components/Modal";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { usePagination } from "@/shared/lib/usePagination";
import type { DocumentRecord } from "@/shared/types";

interface DocumentRow extends DocumentRecord {
  empId: string;
  empName: string;
  empNumber: string;
}

export default function DocumentManagement() {
  const { employees, uploadDocument, approveDocument, rejectDocument, requestDocument, removeDocumentRequirement } =
    useApp();
  const showToast = useToast();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Dashboard cards link here with ?status=pending|missing|uploaded|rejected — open that tab.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("status");
    if (wanted && ["uploaded", "pending", "missing", "rejected"].includes(wanted)) setStatusFilter(wanted);
  }, []);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingRow = useRef<DocumentRow | null>(null);
  const [rejectRow, setRejectRow] = useState<DocumentRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  // "Request a new document": HR asks everyone (or one employee) for an extra requirement.
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestTarget, setRequestTarget] = useState("all");
  const [requestBusy, setRequestBusy] = useState(false);

  // The list of required documents (built-in + added by HR), with a remove control for each.
  const [requirements, setRequirements] = useState<{ name: string; isDefault: boolean }[]>([]);
  const [reqVersion, setReqVersion] = useState(0);
  // Collapsed until HR opens it, so the page stays focused on the documents table.
  const [reqExpanded, setReqExpanded] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeFiles, setRemoveFiles] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/documents/requirements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.requirements) setRequirements(d.requirements);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reqVersion]);

  // Per-document totals across all employees, for the requirements list.
  const requirementStats = useMemo(() => {
    const stats = new Map<string, { uploaded: number; pending: number; missing: number; rejected: number }>();
    employees.forEach((emp) =>
      emp.documents.forEach((d) => {
        const key = d.name.toLowerCase();
        const st = stats.get(key) || {
          uploaded: 0,
          pending: 0,
          missing: 0,
          rejected: 0,
        };
        st[d.status] += 1;
        stats.set(key, st);
      }),
    );
    return stats;
  }, [employees]);

  const removeStats = removeTarget ? requirementStats.get(removeTarget.toLowerCase()) : undefined;
  const removeSubmittedCount = removeStats ? removeStats.uploaded + removeStats.pending + removeStats.rejected : 0;

  async function handleRemoveRequirement() {
    if (!removeTarget) return;
    setRemoveBusy(true);
    const result = await removeDocumentRequirement(removeTarget, removeFiles);
    setRemoveBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(`"${removeTarget}" is no longer a required document.`);
    setRemoveTarget(null);
    setRemoveFiles(false);
    setReqVersion((v) => v + 1);
  }

  function closeRequest() {
    setRequestOpen(false);
    setRequestName("");
    setRequestTarget("all");
  }

  async function handleRequestDocument() {
    if (!requestName.trim()) return;
    setRequestBusy(true);
    const result = await requestDocument(requestName, requestTarget === "all" ? null : requestTarget);
    setRequestBusy(false);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    showToast(
      `"${requestName.trim()}" requested from ${result.requested === 1 ? "1 employee" : `${result.requested} employees`}. It now shows in their Submit a Document choices.`,
    );
    closeRequest();
    setReqVersion((v) => v + 1);
  }

  const rows = useMemo(() => {
    const list: DocumentRow[] = [];
    employees.forEach((emp) => {
      emp.documents.forEach((doc) => {
        list.push({
          empId: emp.id,
          empName: emp.displayName,
          empNumber: emp.employeeNumber,
          ...doc,
        });
      });
    });
    return list;
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesQuery = !q || r.empName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
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
    e.target.value = "";
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
    setRejectNote("");
  }

  function closeReject() {
    setRejectRow(null);
    setRejectNote("");
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

  const missingTotal = rows.filter((r) => r.status === "missing").length;
  const pendingTotal = rows.filter((r) => r.status === "pending").length;

  // Counts for the status tabs (based on the search box, so tab numbers match what you'd see).
  const tabCounts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = rows.filter((r) => !q || r.empName.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
    return {
      all: base.length,
      uploaded: base.filter((r) => r.status === "uploaded").length,
      pending: base.filter((r) => r.status === "pending").length,
      missing: base.filter((r) => r.status === "missing").length,
      rejected: base.filter((r) => r.status === "rejected").length,
    } as Record<string, number>;
  }, [rows, query]);

  const statusTabs = [
    { key: "all", label: "All" },
    { key: "uploaded", label: "Uploaded" },
    { key: "pending", label: "Pending" },
    { key: "missing", label: "Missing" },
    { key: "rejected", label: "Rejected" },
  ];

  function changeTab(key: string) {
    setStatusFilter(key);
    setPage(1);
  }

  return (
    <Layout role="hr" eyebrow="HR › Documents" title="Document Management">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
        <p className="text-ink-muted m-0">
          {rows.length} documents tracked across {employees.length} employees. {missingTotal} are still missing
          {pendingTotal > 0 ? `, ${pendingTotal} awaiting your review` : ""}.
        </p>
        <Button onClick={() => setRequestOpen(true)}>
          <FilePlus2 size={18} />
          Request New Document
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="grid gap-4 items-end">
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
        </div>
      </div>

      {/* Mobile: a menu that lists the status subpages */}
      <div className="md:hidden mb-4">
        <TabMenu
          options={statusTabs.map((t) => ({
            key: t.key,
            label: t.label,
            badge: tabCounts[t.key],
          }))}
          value={statusFilter}
          onChange={changeTab}
          ariaLabel="Filter documents by status"
        />
      </div>

      <div className="hidden md:flex gap-2 flex-wrap mb-4" role="tablist" aria-label="Filter documents by status">
        {statusTabs.map((t) => {
          const active = statusFilter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => changeTab(t.key)}
              className={`inline-flex items-center gap-2 min-h-[40px] px-4 rounded-full font-semibold text-[0.88rem] border-[1.5px] cursor-pointer transition-colors ${
                active ? "bg-navy text-white border-navy" : "bg-white text-navy border-border-strong hover:bg-navy-100"
              }`}
            >
              {t.label}
              <span
                className={`text-[0.78rem] px-2 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-navy-100 text-navy"}`}
              >
                {tabCounts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-white p-4">
        <button
          type="button"
          onClick={() => setReqExpanded((v) => !v)}
          aria-expanded={reqExpanded}
          aria-controls="required-documents-list"
          className={`w-full flex items-center gap-2 bg-transparent border-none p-0 cursor-pointer text-left ${reqExpanded ? "mb-3" : ""}`}
        >
          <ListChecks size={18} className="text-navy" />
          <h3 className="m-0 text-[1rem] flex-1">Required documents ({requirements.length})</h3>
          <span className="text-[0.82rem] text-ink-muted">{reqExpanded ? "Hide" : "Show"}</span>
          <ChevronDown size={18} className={`text-navy transition-transform ${reqExpanded ? "rotate-180" : ""}`} />
        </button>
        {reqExpanded && (
          <div id="required-documents-list">
            {requirements.length === 0 ? (
              <p className="m-0 text-ink-muted text-[0.88rem]">No documents are currently required.</p>
            ) : (
              <ul className="list-none m-0 p-0 grid gap-2">
                {requirements.map((req) => {
                  const st = requirementStats.get(req.name.toLowerCase());
                  return (
                    <li
                      key={req.name}
                      className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <span className="font-semibold text-[0.92rem]">{req.name}</span>
                        {!req.isDefault && (
                          <span className="ml-2 text-[0.72rem] font-bold text-gold-dark uppercase tracking-wide">
                            Added by HR
                          </span>
                        )}
                        <div className="text-[0.78rem] text-ink-muted mt-0.5">
                          {st
                            ? `${st.uploaded} submitted · ${st.pending} pending review · ${st.missing} missing${st.rejected ? ` · ${st.rejected} rejected` : ""}`
                            : "No employee records yet"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRemoveFiles(false);
                          setRemoveTarget(req.name);
                        }}
                        className="inline-flex items-center gap-1.5 text-danger-text font-semibold text-[0.84rem] bg-transparent border border-danger-border rounded-full px-3 min-h-[34px] cursor-pointer hover:bg-danger-bg"
                        aria-label={`Remove required document ${req.name}`}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
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
                  {r.status === "uploaded" && <Tag kind="ok">Uploaded</Tag>}
                  {r.status === "pending" && <Tag kind="warn">Pending Review</Tag>}
                  {r.status === "rejected" && <Tag kind="danger">Rejected</Tag>}
                  {r.status === "missing" && <Tag kind="danger">Missing</Tag>}
                </Td>
                <Td>{r.uploaded || "—"}</Td>
                <Td>
                  {r.status === "pending" ? (
                    <div className="flex items-center gap-2">
                      {r.pendingFileUrl && (
                        <a
                          href={r.pendingFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy font-semibold text-[0.86rem] no-underline hover:underline inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
                          Preview
                        </a>
                      )}
                      <Button
                        sm
                        variant="primary"
                        onClick={() => handleApprove(r)}
                        disabled={busyKey === `${r.empId}-${r.id}`}
                      >
                        {busyKey === `${r.empId}-${r.id}` ? "Approving…" : "Approve"}
                      </Button>
                      <Button
                        sm
                        variant="danger"
                        onClick={() => openReject(r)}
                        disabled={busyKey === `${r.empId}-${r.id}`}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : r.status === "missing" || r.status === "rejected" ? (
                    <div className="flex items-center gap-2">
                      {r.status === "rejected" && r.pendingFileUrl && (
                        <a
                          href={r.pendingFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-navy font-semibold text-[0.86rem] no-underline hover:underline inline-flex items-center gap-1"
                        >
                          <Eye size={14} />
                          View rejected
                        </a>
                      )}
                      <Button
                        sm
                        variant="secondary"
                        onClick={() => handleUploadClick(r)}
                        disabled={busyKey === `${r.empId}-${r.id}`}
                      >
                        {busyKey === `${r.empId}-${r.id}` ? "Uploading…" : "Upload"}
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href={`/hr/employees/${r.empId}`}
                      className="text-navy font-semibold text-[0.86rem] no-underline hover:underline"
                    >
                      View file
                    </Link>
                  )}
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={5} className="text-ink-faint">
                  No documents in this tab match your search.
                </Td>
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
        itemLabel="documents"
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Modal
        open={!!removeTarget}
        onClose={() => (removeBusy ? null : setRemoveTarget(null))}
        title={`Remove "${removeTarget || ""}"?`}
      >
        <p className="text-[0.9rem] text-ink-muted mb-3">
          This document will no longer be required. It's removed from everyone's Submit a Document choices and dashboard
          {removeStats && removeStats.missing > 0
            ? ` (${removeStats.missing} missing record${removeStats.missing === 1 ? "" : "s"} cleared)`
            : ""}
          , and new employees won't be asked for it.
        </p>
        {removeSubmittedCount > 0 && (
          <label className="flex items-start gap-2 text-[0.88rem] mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={removeFiles}
              onChange={(e) => setRemoveFiles(e.target.checked)}
              className="mt-1"
            />
            <span>
              Also permanently delete the {removeSubmittedCount} file
              {removeSubmittedCount === 1 ? "" : "s"} already submitted.{" "}
              <span className="text-ink-muted">(If left unticked, they stay on the employees' 201 files.)</span>
            </span>
          </label>
        )}
        <div className="flex gap-3 mt-4">
          <Button variant="secondary" className="flex-1" onClick={() => setRemoveTarget(null)} disabled={removeBusy}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleRemoveRequirement} disabled={removeBusy}>
            {removeBusy ? "Removing…" : "Remove"}
          </Button>
        </div>
      </Modal>

      <Modal open={requestOpen} onClose={closeRequest} title="Request a new document">
        <p className="text-[0.86rem] text-ink-muted mb-4">
          Add a new requirement. It's marked as missing on the 201 file, shows on the faculty member's dashboard, and
          appears in their Submit a Document choices so they can upload it.
        </p>
        <Field
          label="Document name"
          htmlFor="reqDocName"
          hint="e.g. Barangay Clearance, Updated Resume, TOR (certified copy)"
        >
          <input
            id="reqDocName"
            className={inputCls}
            maxLength={150}
            value={requestName}
            onChange={(e) => setRequestName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Request from" htmlFor="reqDocTarget">
          <select
            id="reqDocTarget"
            className={inputCls}
            value={requestTarget}
            onChange={(e) => setRequestTarget(e.target.value)}
          >
            <option value="all">All employees (and anyone hired later)</option>
            {employees
              .filter((e) => (e.status || "active") === "active")
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.displayName} (#{e.employeeNumber}) only
                </option>
              ))}
          </select>
        </Field>
        <div className="flex gap-3 mt-4">
          <Button variant="secondary" className="flex-1" onClick={closeRequest}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleRequestDocument} disabled={requestBusy || !requestName.trim()}>
            {requestBusy ? "Requesting…" : "Request Document"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!rejectRow} onClose={closeReject} title={rejectRow ? `Reject "${rejectRow.name}"` : ""}>
        <p className="text-[0.86rem] text-ink-muted mb-4">
          The file {rejectRow?.empName} submitted won't be applied to their 201 file, but it stays on record so you can
          still view it under Rejected. They'll see this document as rejected and can resubmit.
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
          <Button variant="secondary" className="flex-1" onClick={closeReject}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleConfirmReject} disabled={rejectBusy}>
            {rejectBusy ? "Rejecting…" : "Reject Document"}
          </Button>
        </div>
      </Modal>
    </Layout>
  );
}
