"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button, inputCls } from "@/shared/components/ui";
import Modal from "@/shared/components/Modal";
import { useToast } from "@/shared/context/ToastContext";
import type { DepartmentInfo, DepartmentResult } from "@/shared/lib/useDepartments";

/** HR: add or remove departments/colleges (e.g. when the school opens a new course). Changes
 *  show up in the employee forms, the list filter and announcements. */
export default function ManageDepartmentsModal({
  open,
  onClose,
  details,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onClose: () => void;
  details: DepartmentInfo[];
  onAdd: (name: string) => Promise<DepartmentResult>;
  onRemove: (name: string) => Promise<DepartmentResult>;
}) {
  const showToast = useToast();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  function close() {
    setName("");
    setError("");
    setConfirming(null);
    onClose();
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    const result = await onAdd(name);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast(`Department "${result.name}" added.`);
    setName("");
  }

  async function handleRemove(dept: string) {
    setRemoving(true);
    setError("");
    const result = await onRemove(dept);
    setRemoving(false);
    setConfirming(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast(`Department "${result.name}" removed.`);
  }

  return (
    <Modal open={open} onClose={close} title="Manage departments">
      <form onSubmit={handleAdd} className="mb-4">
        <label htmlFor="newDepartment" className="block text-[0.86rem] font-semibold text-ink mb-1.5">
          Add a department / college
        </label>
        <div className="flex gap-2">
          <input
            id="newDepartment"
            className={inputCls}
            placeholder="e.g. College of Nursing"
            value={name}
            maxLength={120}
            autoFocus
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
          />
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </div>
      </form>

      {error && (
        <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
          {error}
        </p>
      )}

      <p className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-2">Current departments</p>
      <ul className="border border-border rounded-xl divide-y divide-border mb-5">
        {details.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="font-semibold text-ink text-[0.92rem] truncate">{d.name}</p>
              <p className="text-[0.78rem] text-ink-muted">
                {d.employeeCount} employee{d.employeeCount === 1 ? "" : "s"}
              </p>
            </div>
            {confirming === d.name ? (
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="secondary" sm onClick={() => setConfirming(null)} disabled={removing}>
                  Cancel
                </Button>
                <Button type="button" variant="danger" sm onClick={() => handleRemove(d.name)} disabled={removing}>
                  {removing ? "Deleting…" : "Confirm"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="danger"
                sm
                disabled={d.employeeCount > 0}
                title={d.employeeCount > 0 ? "Reassign this department's employees before deleting it" : undefined}
                onClick={() => {
                  setError("");
                  setConfirming(d.name);
                }}
              >
                <Trash2 size={14} />
                Delete
              </Button>
            )}
          </li>
        ))}
        {details.length === 0 && <li className="px-3.5 py-3 text-ink-muted text-[0.9rem]">No departments yet.</li>}
      </ul>

      <Button type="button" variant="secondary" className="w-full" onClick={close}>
        Done
      </Button>
    </Modal>
  );
}
