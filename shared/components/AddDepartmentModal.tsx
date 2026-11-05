"use client";

import { useState } from "react";
import { Button, Field, inputCls, Tag } from "@/shared/components/ui";
import Modal from "@/shared/components/Modal";
import { useToast } from "@/shared/context/ToastContext";
import { useDepartments } from "@/shared/lib/useDepartments";

/** HR: add a new department/college (e.g. when the school opens a new course). Once added it
 *  appears in the Department dropdowns of the employee forms and in announcements. */
export default function AddDepartmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const showToast = useToast();
  const { departments, addDepartment } = useDepartments();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setName("");
    setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError("");
    const result = await addDepartment(name);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast(`Department "${result.name}" added.`);
    close();
  }

  return (
    <Modal open={open} onClose={close} title="Add department">
      <form onSubmit={handleSubmit}>
        <Field label="Department / College name" htmlFor="newDepartment">
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
        </Field>
        {error && (
          <p className="text-[0.86rem] text-danger-text bg-danger-bg border border-danger-border rounded-lg px-3 py-2.5 mb-4">
            {error}
          </p>
        )}

        <p className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-2">Current departments</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {departments.map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" disabled={saving || !name.trim()}>
            {saving ? "Adding…" : "Add Department"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
