"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { Plus, Search, Camera, X, Upload, FileCheck2 } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Button, Field, inputCls, Tag, Avatar } from "@/shared/components/ui";
import { TableWrap, Th, Td, CellName, CellSub } from "@/shared/components/Table";
import Pagination from "@/shared/components/Pagination";
import Modal from "@/shared/components/Modal";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { usePagination } from "@/shared/lib/usePagination";
import { DEACTIVATION_REASONS, EMPLOYMENT_STATUSES, DEPARTMENTS } from "@/shared/lib/roles";
import { parsePdsImportText } from "@/shared/lib/pds";
import { toInputDate, fromInputDate } from "@/shared/lib/dateFormat";
import { documentCompletion } from "@/shared/lib/documentCompletion";
import type { Employee, PdsDetails } from "@/shared/types";

const emptyForm = {
  displayName: "",
  fullName: "",
  employeeNumber: "",
  department: DEPARTMENTS[0] as string,
  position: "",
  employmentType: "Full-time",
  dateHired: "",
  employmentStatus: "Regular",
  contractStart: "",
  contractEnd: "",
  supervisor: "",
  dob: "",
  civilStatus: "Single",
  nationality: "Filipino",
  contact: "",
  email: "",
};

export default function HREmployees() {
  const { employees, addEmployee, uploadEmployeePhoto, uploadDocument, setEmployeeStatus } = useApp();
  const showToast = useToast();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("All departments");
  const [statusFilter, setStatusFilter] = useState("active");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [pdsData, setPdsData] = useState<Partial<PdsDetails> | null>(null);
  const [pdsFileName, setPdsFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [numberError, setNumberError] = useState("");
  const [deactivateTarget, setDeactivateTarget] = useState<Employee | null>(null);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pdsInputRef = useRef<HTMLInputElement>(null);
  const contractInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(null);
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const departments = useMemo(() => ["All departments", ...new Set(employees.map((e) => e.department))], [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      const matchesQuery = !q || e.displayName.toLowerCase().includes(q) || e.employeeNumber.includes(q);
      const matchesDept = dept === "All departments" || e.department === dept;
      const matchesStatus = statusFilter === "all" || (e.status || "active") === statusFilter;
      return matchesQuery && matchesDept && matchesStatus;
    });
  }, [employees, query, dept, statusFilter]);

  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(filtered, 10);

  function docStatusTag(emp: Employee) {
    const { missingCount, rejectedCount, isComplete } = documentCompletion(emp.documents);
    if (isComplete) return <Tag kind="ok">Complete</Tag>;
    if (rejectedCount > 0) return <Tag kind="danger">{rejectedCount} rejected</Tag>;
    return <Tag kind={missingCount > 1 ? "danger" : "warn"}>{missingCount} missing</Tag>;
  }

  function closeAdd() {
    setAddOpen(false);
    setEmailError("");
    setNumberError("");
    setForm(emptyForm);
    setPhotoFile(null);
    setContractFile(null);
    setPdsData(null);
    setPdsFileName(null);
  }

  function handlePdsImportClick() {
    pdsInputRef.current?.click();
  }

  async function handlePdsFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parsePdsImportText(text);
      if (Object.keys(imported).length === 0) {
        showToast("That file did not contain any recognizable PDS fields.");
        return;
      }
      setPdsData(imported);
      setPdsFileName(file.name);
      showToast("PDS data loaded — it will be attached to the new record.");
    } catch {
      showToast("Could not read that file. Please choose a valid PDS JSON file.");
    }
  }

  function clearPdsImport() {
    setPdsData(null);
    setPdsFileName(null);
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!form.displayName.trim() || !form.employeeNumber.trim()) return;
    setEmailError("");
    setNumberError("");

    // Quick checks against the records already loaded (the server re-checks as the final say).
    const typedNumber = form.employeeNumber.trim().toLowerCase();
    const typedEmail = form.email.trim().toLowerCase();
    const numberTaken = employees.some((emp) => (emp.employeeNumber || "").trim().toLowerCase() === typedNumber);
    const emailTaken = !!typedEmail && employees.some((emp) => (emp.email || "").trim().toLowerCase() === typedEmail);
    if (numberTaken) setNumberError("An employee record with this employee number already exists.");
    if (emailTaken) setEmailError("An employee with this email address already exists.");
    if (numberTaken || emailTaken) return;

    setSaving(true);
    const created = await addEmployee({
      ...form,
      fullName: form.fullName || form.displayName,
      ...(pdsData ? { pds: pdsData } : {}),
    });
    if (!created.ok) {
      setSaving(false);
      // Duplicate errors are shown inline on the offending field; anything else gets a toast.
      if (/employee number/i.test(created.error)) {
        setNumberError(created.error);
      } else if (/email/i.test(created.error)) {
        setEmailError(created.error);
      } else {
        showToast(created.error || "Could not create the employee record. Please try again.", "error");
      }
      return;
    }
    const id = created.id;
    if (photoFile) {
      const result = await uploadEmployeePhoto(id, photoFile);
      if (!result.ok) showToast(`Employee created, but the photo failed to upload: ${result.error}`);
    }
    if (contractFile) {
      try {
        const res = await fetch(`/api/employees/${id}`);
        const data = await res.json().catch(() => ({}));
        const contractDoc = (data.employee?.documents || []).find(
          (d: { name: string }) => d.name === "Employment Contract",
        );
        if (!contractDoc) throw new Error("Employment Contract record not found.");
        const result = await uploadDocument(id, contractDoc.id, contractFile);
        if (!result.ok) throw new Error(result.error);
      } catch (err) {
        showToast(
          `Employee created, but the contract file failed to upload: ${err instanceof Error ? err.message : "unknown error"}`,
        );
      }
    }
    setSaving(false);
    closeAdd();
    showToast(`Employee record created for ${form.displayName}.`);
  }

  function openDeactivate(emp: Employee) {
    setDeactivateTarget(emp);
    setDeactivateReason("");
  }

  function closeDeactivate() {
    setDeactivateTarget(null);
    setDeactivateReason("");
  }

  async function handleDeactivate(e: FormEvent) {
    e.preventDefault();
    if (!deactivateReason || !deactivateTarget) return;
    setStatusBusy(true);
    const result = await setEmployeeStatus(deactivateTarget.id, "inactive", deactivateReason);
    setStatusBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${deactivateTarget.displayName} was marked inactive (${deactivateReason}).`);
    closeDeactivate();
  }

  async function handleReactivate(emp: Employee) {
    setStatusBusy(true);
    const result = await setEmployeeStatus(emp.id, "active");
    setStatusBusy(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${emp.displayName} was reactivated.`);
  }

  return (
    <Layout role="hr" eyebrow="HR › Records" title="Employee Records">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-ink-muted m-0">
          {employees.length} employees on file. Search, filter, or open a 201 file below.
        </p>
        <Button variant="gold" onClick={() => setAddOpen(true)}>
          <Plus size={18} />
          Add Employee
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl shadow-card p-5 mb-5">
        <div className="grid gap-4 md:grid-cols-3 items-end">
          <div className="relative">
            <Search size={20} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              placeholder="Search by name or employee number"
              aria-label="Search employees"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={`${inputCls} pl-11`}
            />
          </div>
          <select
            aria-label="Filter by department"
            className={inputCls}
            value={dept}
            onChange={(e) => setDept(e.target.value)}
          >
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            className={inputCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <TableWrap>
        <table className="w-full border-collapse min-w-[820px]">
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Department</Th>
              <Th>Position</Th>
              <Th>Status</Th>
              <Th>Document Status</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((emp) => (
              <tr key={emp.id} className="hover:bg-[#FBFAF7]">
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar photoUrl={emp.photoUrl} initials={emp.initials} color="hr" size="sm" />
                    <div>
                      <CellName>{emp.displayName}</CellName>
                      <CellSub>Employee #{emp.employeeNumber}</CellSub>
                    </div>
                  </div>
                </Td>
                <Td>{emp.department}</Td>
                <Td>{emp.position}</Td>
                <Td>
                  {(emp.status || "active") === "active" ? (
                    <Tag kind="ok">Active</Tag>
                  ) : (
                    <Tag kind="neutral">Inactive{emp.deactivationReason ? ` — ${emp.deactivationReason}` : ""}</Tag>
                  )}
                </Td>
                <Td>{docStatusTag(emp)}</Td>
                <Td>
                  <div className="flex gap-2">
                    <Link
                      href={`/hr/employees/${emp.id}`}
                      className="inline-flex items-center justify-center min-h-[38px] px-3.5 rounded-lg font-semibold text-[0.86rem] bg-white text-navy border-[1.5px] border-border-strong hover:bg-navy-100 no-underline"
                    >
                      View
                    </Link>
                    {(emp.status || "active") === "active" ? (
                      <Button variant="danger" sm onClick={() => openDeactivate(emp)}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button variant="secondary" sm onClick={() => handleReactivate(emp)} disabled={statusBusy}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td colSpan={6} className="text-ink-faint">
                  No employees match your filters.
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
        itemLabel="employees"
      />

      <Modal open={addOpen} onClose={closeAdd} title="Add employee record" wide>
        <form onSubmit={handleAdd}>
          <Field label="Photo (optional)">
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <Avatar
                  photoUrl={photoPreview}
                  initials={
                    form.displayName
                      ? form.displayName
                          .trim()
                          .split(/\s+/)
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()
                      : "?"
                  }
                  color="hr"
                  size="lg"
                />
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  title="Choose photo"
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center border-2 border-white hover:bg-navy-dark cursor-pointer"
                >
                  <Camera size={14} />
                </button>
              </div>
              <div>
                <Button type="button" variant="secondary" sm onClick={() => photoInputRef.current?.click()}>
                  {photoFile ? "Change photo" : "Choose photo"}
                </Button>
                {photoFile && (
                  <button
                    type="button"
                    onClick={() => setPhotoFile(null)}
                    className="ml-2 inline-flex items-center gap-1 text-[0.86rem] text-danger-text hover:underline"
                  >
                    <X size={14} />
                    Remove
                  </button>
                )}
                <p className="text-[0.8rem] text-ink-faint mt-1.5 mb-0">JPG, PNG, or WEBP, up to 5MB.</p>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
            </div>
          </Field>
          <Field
            label="Import PDS (optional)"
            hint="Upload a previously exported PDS JSON file to prefill this employee's PDS Details."
          >
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="button" variant="secondary" sm onClick={handlePdsImportClick}>
                <Upload size={14} />
                {pdsFileName ? "Replace file" : "Choose file"}
              </Button>
              {pdsFileName && (
                <>
                  <span className="inline-flex items-center gap-1.5 text-[0.86rem] text-ink-muted">
                    <FileCheck2 size={14} className="text-ok-text" />
                    {pdsFileName}
                  </span>
                  <button
                    type="button"
                    onClick={clearPdsImport}
                    className="inline-flex items-center gap-1 text-[0.86rem] text-danger-text hover:underline"
                  >
                    <X size={14} />
                    Remove
                  </button>
                </>
              )}
              <input
                ref={pdsInputRef}
                type="file"
                accept="application/json"
                className="hidden"
                onChange={handlePdsFileChange}
              />
            </div>
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Full name">
              <input
                className={inputCls}
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                required
              />
            </Field>
            <Field
              label="Employee number"
              hint={numberError ? <span className="text-danger-text">{numberError}</span> : undefined}
            >
              <input
                className={`${inputCls} ${numberError ? "border-danger-text" : ""}`}
                value={form.employeeNumber}
                onChange={(e) => {
                  setForm({ ...form, employeeNumber: e.target.value });
                  setNumberError("");
                }}
                required
              />
            </Field>
            <Field label="Department">
              <select
                className={inputCls}
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Position">
              <input
                className={inputCls}
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </Field>
            <Field label="Date hired">
              <input
                type="date"
                className={inputCls}
                value={toInputDate(form.dateHired)}
                onChange={(e) => setForm({ ...form, dateHired: fromInputDate(e.target.value) })}
              />
            </Field>
            <Field label="Employment status">
              <select
                className={inputCls}
                value={form.employmentStatus}
                onChange={(e) => {
                  const employmentStatus = e.target.value;
                  setForm({
                    ...form,
                    employmentStatus,
                    contractEnd: employmentStatus === "Regular" ? "" : form.contractEnd,
                  });
                }}
              >
                {EMPLOYMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Contract start">
              <input
                type="date"
                className={inputCls}
                value={toInputDate(form.contractStart)}
                onChange={(e) => setForm({ ...form, contractStart: fromInputDate(e.target.value) })}
              />
            </Field>
            <Field
              label="Contract end"
              hint={form.employmentStatus === "Regular" ? "Not applicable for Regular employees" : undefined}
            >
              <input
                type="date"
                className={inputCls}
                value={toInputDate(form.contractEnd)}
                min={toInputDate(form.contractStart) || undefined}
                onChange={(e) => setForm({ ...form, contractEnd: fromInputDate(e.target.value) })}
                disabled={form.employmentStatus === "Regular"}
              />
            </Field>
            <Field
              label="Employment contract file (optional)"
              hint="PDF or image. Saved as the Employment Contract document."
            >
              <div className="flex items-center gap-3 flex-wrap">
                <Button type="button" variant="secondary" sm onClick={() => contractInputRef.current?.click()}>
                  <Upload size={14} />
                  {contractFile ? "Replace file" : "Choose file"}
                </Button>
                {contractFile && (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[0.86rem] text-ink-muted">
                      <FileCheck2 size={14} className="text-ok-text" />
                      {contractFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setContractFile(null)}
                      className="inline-flex items-center gap-1 text-[0.86rem] text-danger-text hover:underline"
                    >
                      <X size={14} />
                      Remove
                    </button>
                  </>
                )}
                <input
                  ref={contractInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => setContractFile(e.target.files?.[0] || null)}
                />
              </div>
            </Field>
            <Field label="Supervisor">
              <input
                className={inputCls}
                value={form.supervisor}
                onChange={(e) => setForm({ ...form, supervisor: e.target.value })}
              />
            </Field>
            <Field label="Contact number">
              <input
                className={inputCls}
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </Field>
            <Field
              label="Email address"
              hint={emailError ? <span className="text-danger-text">{emailError}</span> : undefined}
            >
              <input
                type="email"
                className={`${inputCls} ${emailError ? "border-danger-text" : ""}`}
                value={form.email}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  setEmailError("");
                }}
              />
            </Field>
          </div>
          <Button type="submit" className="w-full mt-2" disabled={saving}>
            {saving ? "Creating…" : "Create Record"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={!!deactivateTarget}
        onClose={closeDeactivate}
        title={`Deactivate — ${deactivateTarget?.displayName || ""}`}
      >
        <form onSubmit={handleDeactivate}>
          <p className="text-ink-muted text-[0.9rem] mt-0 mb-4">
            This marks the 201 file for <strong>{deactivateTarget?.displayName}</strong> as inactive. The record and its
            documents are kept — you can reactivate it later.
          </p>
          <Field label="Reason for deactivating">
            <select
              className={inputCls}
              value={deactivateReason}
              onChange={(e) => setDeactivateReason(e.target.value)}
              required
            >
              <option value="" disabled>
                Select a reason
              </option>
              {DEACTIVATION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3 mt-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={closeDeactivate}
              disabled={statusBusy}
            >
              Cancel
            </Button>
            <Button type="submit" variant="danger" className="flex-1" disabled={statusBusy || !deactivateReason}>
              {statusBusy ? "Deactivating…" : "Deactivate"}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}
