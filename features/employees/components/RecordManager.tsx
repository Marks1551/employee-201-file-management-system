"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Archive, Pencil, Plus, Trash2 } from "lucide-react";
import { ContinueNote, LINE, LABEL_BG, tdCls } from "@/features/employees/components/PdsSheet";
import { Button, Field, inputCls } from "@/shared/components/ui";
import { TableWrap, Th, Td } from "@/shared/components/Table";
import Pagination from "@/shared/components/Pagination";
import Modal from "@/shared/components/Modal";
import { useToast } from "@/shared/context/ToastContext";
import { usePagination } from "@/shared/lib/usePagination";
import { toInputDate, fromInputDate } from "@/shared/lib/dateFormat";
import type { ActionResult } from "@/shared/context/AppContext";

type FieldType = "text" | "textarea" | "select" | "number" | "date";

interface FieldOption {
  value?: string | number;
  label?: string;
}

export interface RecordField {
  key: string;
  label: string;
  type?: FieldType;
  options?: (FieldOption | string)[];
  hint?: string;
  required?: boolean;
  /** When set, the field only shows (and only counts as required) while this returns true. */
  showWhen?: (form: Record<string, unknown>) => boolean;
  /**
   * Computes this field from the other fields (e.g. hours from the From / To dates). It fills in
   * automatically while the field is empty or still holds the previous computed value; once the user
   * types their own value it is left alone.
   */
  autoFill?: (form: Record<string, unknown>) => string;
}

export interface RecordColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => ReactNode;
}

/** Base shape every record item must have. Individual sections add their own fields on top. */
export interface RecordItem {
  id: string;
}

interface RecordManagerProps<T extends RecordItem> {
  items: T[];
  fields: RecordField[];
  columns?: RecordColumn<T>[];
  emptyForm: Record<string, unknown>;
  itemLabel: (item: T) => ReactNode;
  typeLabel: string;
  addButtonLabel: string;
  emptyMessage: ReactNode;
  employeeName: ReactNode;
  onAdd: (data: Record<string, unknown>) => Promise<ActionResult>;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<ActionResult>;
  /** Omit to hide the Delete/Archive button (e.g. for roles that may add and edit only). */
  onDelete?: (id: string) => Promise<ActionResult>;
  /** When true, the remove action reads "Archive" (record is hidden, not erased). */
  archive?: boolean;
  rowActions?: (item: T) => ReactNode;
  readOnly?: boolean;
  /**
   * Render as a section of the printed CS Form 212: official column headings, ruled blank rows and a
   * red "(Continue on sheet …)" note, instead of the app's regular card table. The add / edit / archive
   * modals are unchanged.
   */
  formStyle?: {
    /** Column widths in %, one per `columns` entry (the action column is added automatically). */
    widths: number[];
    /** Heading row(s). `action` is the extra header cell for the row-action column (null when read-only). */
    head: (action: ReactNode) => ReactNode;
    /** Number of heading rows, so the action header can span them. */
    headRows?: number;
    /** Always show at least this many rows, padding with blank ruled rows. */
    minRows?: number;
    /** Sheet named in the "(Continue on sheet …)" note; omit for no note. */
    continueSheet?: string;
  };
}

type ModalState<T> = { mode: "add" } | { mode: "edit"; item: T } | null;

/**
 * Reusable "list of records" manager: a table of items plus add/edit/delete
 * modals, driven entirely by a `fields` config. Used for an employee's
 * training, educational background, work experience, performance, and
 * attendance sections so each one doesn't need its own bespoke table+modal.
 */
export default function RecordManager<T extends RecordItem>({
  items,
  fields,
  columns,
  emptyForm,
  itemLabel,
  typeLabel,
  addButtonLabel,
  emptyMessage,
  employeeName,
  onAdd,
  onUpdate,
  onDelete,
  archive = false,
  rowActions,
  readOnly = false,
  formStyle,
}: RecordManagerProps<T>) {
  const showToast = useToast();
  const cols: RecordColumn<T>[] = columns || fields.map((f) => ({ key: f.key, label: f.label }));
  const [modal, setModal] = useState<ModalState<T>>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(items, 8);

  /** Updates one field, then recomputes any `autoFill` field that was blank or still auto-filled. */
  function setField(key: string, value: unknown) {
    setForm((prev) => {
      const next: Record<string, unknown> = { ...prev, [key]: value };
      for (const f of fields) {
        if (!f.autoFill || f.key === key) continue;
        const current = String(prev[f.key] ?? "").trim();
        if (!current || current === f.autoFill(prev)) next[f.key] = f.autoFill(next);
      }
      return next;
    });
  }

  function openAdd() {
    setForm(emptyForm);
    setModal({ mode: "add" });
  }

  function openEdit(item: T) {
    const next: Record<string, unknown> = { ...emptyForm };
    for (const f of fields) next[f.key] = (item as Record<string, unknown>)[f.key] ?? emptyForm[f.key] ?? "";
    setForm(next);
    setModal({ mode: "edit", item });
  }

  function closeModal() {
    setModal(null);
    setForm(emptyForm);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const requiredField = fields.find(
      (f) => f.required && (!f.showWhen || f.showWhen(form)) && !String(form[f.key] ?? "").trim(),
    );
    if (requiredField) return;
    setSaving(true);
    const result = modal.mode === "add" ? await onAdd(form) : await onUpdate(modal.item.id, form);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(
      modal.mode === "add"
        ? `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} added.`
        : `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} updated.`,
    );
    closeModal();
  }

  const verb = archive ? "Archive" : "Delete";

  async function handleDelete() {
    if (!deleteTarget || !onDelete) return;
    setDeleting(true);
    const result = await onDelete(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} ${archive ? "archived" : "removed"}.`);
    setDeleteTarget(null);
  }

  const modals = !readOnly && (
    <>
      <Modal open={!!modal} onClose={closeModal} title={modal?.mode === "add" ? addButtonLabel : `Edit ${typeLabel}`}>
        <form onSubmit={handleSave}>
          {fields
            .filter((f) => !f.showWhen || f.showWhen(form))
            .map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                {f.type === "select" ? (
                  <select
                    className={inputCls}
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  >
                    {(f.options || []).map((o) => {
                      const opt = typeof o === "string" ? { value: o, label: o } : o;
                      return (
                        <option key={String(opt.value)} value={opt.value}>
                          {opt.label ?? opt.value}
                        </option>
                      );
                    })}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    className={`${inputCls} min-h-[90px] py-2.5`}
                    value={(form[f.key] as string) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                ) : f.type === "date" ? (
                  <input
                    type="date"
                    className={inputCls}
                    value={toInputDate(form[f.key] as string)}
                    onChange={(e) => setField(f.key, fromInputDate(e.target.value))}
                    required={f.required}
                  />
                ) : (
                  <input
                    type={f.type === "number" ? "number" : "text"}
                    className={inputCls}
                    value={(form[f.key] as string | number) ?? ""}
                    onChange={(e) => setField(f.key, e.target.value)}
                    required={f.required}
                  />
                )}
              </Field>
            ))}
          <Button type="submit" className="w-full mt-2" disabled={saving}>
            {saving ? "Saving…" : modal?.mode === "add" ? addButtonLabel : "Save Changes"}
          </Button>
        </form>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`${verb} ${typeLabel}`}>
        <p className="text-ink mb-1">
          {archive ? "Archive" : "Remove"} <strong>{deleteTarget ? itemLabel(deleteTarget) : ""}</strong> from{" "}
          {employeeName}&apos;s {typeLabel} records?
        </p>
        <p className="text-[0.86rem] text-ink-muted mb-5">
          {archive
            ? "It will be hidden from this employee's file but kept in the system records."
            : "This cannot be undone."}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
            {deleting ? (archive ? "Archiving…" : "Deleting…") : verb}
          </Button>
        </div>
      </Modal>
    </>
  );

  if (formStyle) {
    const blanks = Math.max(0, (formStyle.minRows ?? 0) - items.length);
    const actionTh = readOnly ? null : (
      <th
        data-print-hide
        rowSpan={formStyle.headRows ?? 1}
        className={`border ${LINE} ${LABEL_BG} w-[68px]`}
        aria-label="Actions"
      />
    );
    return (
      <div>
        {!readOnly && (
          <div data-print-hide className={`flex justify-end border-b ${LINE} bg-amber-50 px-2 py-1`}>
            <button
              type="button"
              onClick={openAdd}
              className="inline-flex cursor-pointer items-center gap-1 rounded border border-neutral-700 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-black hover:bg-neutral-100"
            >
              <Plus size={13} />
              {addButtonLabel}
            </button>
          </div>
        )}
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {formStyle.widths.map((w, i) => (
              <col key={i} style={{ width: `${w}%` }} />
            ))}
            {!readOnly && <col data-print-hide style={{ width: 68 }} />}
          </colgroup>
          <thead>{formStyle.head(actionTh)}</thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                {cols.map((c) => (
                  <td key={c.key} className={tdCls}>
                    {c.render ? c.render(item) : ((item as Record<string, unknown>)[c.key] as ReactNode) || ""}
                  </td>
                ))}
                {!readOnly && (
                  <td data-print-hide className={`${tdCls} text-center`}>
                    <div className="flex items-center justify-center gap-1">
                      {rowActions && rowActions(item)}
                      <button
                        type="button"
                        title={`Edit ${typeLabel}`}
                        aria-label={`Edit ${typeLabel}`}
                        onClick={() => openEdit(item)}
                        className="cursor-pointer rounded p-1 text-navy hover:bg-navy-100"
                      >
                        <Pencil size={14} />
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          title={`${verb} ${typeLabel}`}
                          aria-label={`${verb} ${typeLabel}`}
                          onClick={() => setDeleteTarget(item)}
                          className="cursor-pointer rounded p-1 text-danger-text hover:bg-danger-bg"
                        >
                          {archive ? <Archive size={14} /> : <Trash2 size={14} />}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {Array.from({ length: blanks }).map((_, r) => (
              <tr key={`blank-${r}`}>
                {cols.map((c) => (
                  <td key={c.key} className={`${tdCls} h-[26px]`} />
                ))}
                {!readOnly && <td data-print-hide className={tdCls} />}
              </tr>
            ))}
          </tbody>
        </table>
        {formStyle.continueSheet && <ContinueNote sheet={formStyle.continueSheet} />}
        {modals}
      </div>
    );
  }

  return (
    <div>
      {!readOnly && (
        <div className="flex justify-end mb-3">
          <Button variant="secondary" sm onClick={openAdd}>
            <Plus size={16} />
            {addButtonLabel}
          </Button>
        </div>
      )}
      <TableWrap>
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr>
              {cols.map((c) => (
                <Th key={c.key}>{c.label}</Th>
              ))}
              {!readOnly && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <Td className="text-ink-faint">{emptyMessage}</Td>
              </tr>
            )}
            {pageItems.map((item) => (
              <tr key={item.id} className="hover:bg-[#FBFAF7]">
                {cols.map((c, i) => (
                  <Td key={c.key} className={i === 0 ? "font-semibold text-ink" : ""}>
                    {c.render ? c.render(item) : ((item as Record<string, unknown>)[c.key] as ReactNode) || "—"}
                  </Td>
                ))}
                {!readOnly && (
                  <Td>
                    <div className="flex gap-2 flex-wrap">
                      {rowActions && rowActions(item)}
                      <Button variant="ghost" sm onClick={() => openEdit(item)}>
                        <Pencil size={14} />
                        Edit
                      </Button>
                      {onDelete && (
                        <Button variant="danger" sm onClick={() => setDeleteTarget(item)}>
                          {archive ? <Archive size={14} /> : <Trash2 size={14} />}
                          {verb}
                        </Button>
                      )}
                    </div>
                  </Td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalItems={items.length}
        startIndex={startIndex}
        endIndex={endIndex}
        itemLabel={`${typeLabel} records`}
      />

      {!readOnly && (
        <>
          <Modal
            open={!!modal}
            onClose={closeModal}
            title={modal?.mode === "add" ? addButtonLabel : `Edit ${typeLabel}`}
          >
            <form onSubmit={handleSave}>
              {fields
                .filter((f) => !f.showWhen || f.showWhen(form))
                .map((f) => (
                  <Field key={f.key} label={f.label} hint={f.hint}>
                    {f.type === "select" ? (
                      <select
                        className={inputCls}
                        value={(form[f.key] as string) ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                      >
                        {(f.options || []).map((o) => {
                          const opt = typeof o === "string" ? { value: o, label: o } : o;
                          return (
                            <option key={String(opt.value)} value={opt.value}>
                              {opt.label ?? opt.value}
                            </option>
                          );
                        })}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea
                        className={`${inputCls} min-h-[90px] py-2.5`}
                        value={(form[f.key] as string) ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                      />
                    ) : f.type === "date" ? (
                      <input
                        type="date"
                        className={inputCls}
                        value={toInputDate(form[f.key] as string)}
                        onChange={(e) => setField(f.key, fromInputDate(e.target.value))}
                        required={f.required}
                      />
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        className={inputCls}
                        value={(form[f.key] as string | number) ?? ""}
                        onChange={(e) => setField(f.key, e.target.value)}
                        required={f.required}
                      />
                    )}
                  </Field>
                ))}
              <Button type="submit" className="w-full mt-2" disabled={saving}>
                {saving ? "Saving…" : modal?.mode === "add" ? addButtonLabel : "Save Changes"}
              </Button>
            </form>
          </Modal>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`${verb} ${typeLabel}`}>
            <p className="text-ink mb-1">
              {archive ? "Archive" : "Remove"} <strong>{deleteTarget ? itemLabel(deleteTarget) : ""}</strong> from{" "}
              {employeeName}&apos;s {typeLabel} records?
            </p>
            <p className="text-[0.86rem] text-ink-muted mb-5">
              {archive
                ? "It will be hidden from this employee's file but kept in the system records."
                : "This cannot be undone."}
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? (archive ? "Archiving…" : "Deleting…") : verb}
              </Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
