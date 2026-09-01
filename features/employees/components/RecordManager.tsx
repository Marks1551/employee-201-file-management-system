'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Field, inputCls } from '@/shared/components/ui';
import { TableWrap, Th, Td } from '@/shared/components/Table';
import Pagination from '@/shared/components/Pagination';
import Modal from '@/shared/components/Modal';
import { useToast } from '@/shared/context/ToastContext';
import { usePagination } from '@/shared/lib/usePagination';
import type { ActionResult } from '@/shared/context/AppContext';

type FieldType = 'text' | 'textarea' | 'select' | 'number';

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
  onDelete: (id: string) => Promise<ActionResult>;
  rowActions?: (item: T) => ReactNode;
  readOnly?: boolean;
}

type ModalState<T> = { mode: 'add' } | { mode: 'edit'; item: T } | null;

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
  rowActions,
  readOnly = false,
}: RecordManagerProps<T>) {
  const showToast = useToast();
  const cols: RecordColumn<T>[] = columns || fields.map((f) => ({ key: f.key, label: f.label }));
  const [modal, setModal] = useState<ModalState<T>>(null);
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { page, setPage, totalPages, pageItems, startIndex, endIndex } = usePagination(items, 8);

  function openAdd() {
    setForm(emptyForm);
    setModal({ mode: 'add' });
  }

  function openEdit(item: T) {
    const next: Record<string, unknown> = { ...emptyForm };
    for (const f of fields) next[f.key] = (item as Record<string, unknown>)[f.key] ?? emptyForm[f.key] ?? '';
    setForm(next);
    setModal({ mode: 'edit', item });
  }

  function closeModal() {
    setModal(null);
    setForm(emptyForm);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!modal) return;
    const requiredField = fields.find((f) => f.required && !String(form[f.key] ?? '').trim());
    if (requiredField) return;
    setSaving(true);
    const result = modal.mode === 'add' ? await onAdd(form) : await onUpdate(modal.item.id, form);
    setSaving(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(modal.mode === 'add' ? `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} added.` : `${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} updated.`);
    closeModal();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await onDelete(deleteTarget.id);
    setDeleting(false);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    showToast(`${typeLabel[0].toUpperCase()}${typeLabel.slice(1)} removed.`);
    setDeleteTarget(null);
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
              {cols.map((c) => <Th key={c.key}>{c.label}</Th>)}
              {!readOnly && <Th>Actions</Th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><Td className="text-ink-faint">{emptyMessage}</Td></tr>
            )}
            {pageItems.map((item) => (
              <tr key={item.id} className="hover:bg-[#FBFAF7]">
                {cols.map((c, i) => (
                  <Td key={c.key} className={i === 0 ? 'font-semibold text-ink' : ''}>
                    {c.render ? c.render(item) : (((item as Record<string, unknown>)[c.key] as ReactNode) || '—')}
                  </Td>
                ))}
                {!readOnly && (
                  <Td>
                    <div className="flex gap-2 flex-wrap">
                      {rowActions && rowActions(item)}
                      <Button variant="ghost" sm onClick={() => openEdit(item)}><Pencil size={14} />Edit</Button>
                      <Button variant="danger" sm onClick={() => setDeleteTarget(item)}><Trash2 size={14} />Delete</Button>
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
          <Modal open={!!modal} onClose={closeModal} title={modal?.mode === 'add' ? addButtonLabel : `Edit ${typeLabel}`}>
            <form onSubmit={handleSave}>
              {fields.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  {f.type === 'select' ? (
                    <select className={inputCls} value={(form[f.key] as string) ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>
                      {(f.options || []).map((o) => {
                        const opt = typeof o === 'string' ? { value: o, label: o } : o;
                        return <option key={String(opt.value)} value={opt.value}>{opt.label ?? opt.value}</option>;
                      })}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      className={`${inputCls} min-h-[90px] py-2.5`}
                      value={(form[f.key] as string) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    />
                  ) : (
                    <input
                      type={f.type === 'number' ? 'number' : 'text'}
                      className={inputCls}
                      value={(form[f.key] as string | number) ?? ''}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      required={f.required}
                    />
                  )}
                </Field>
              ))}
              <Button type="submit" className="w-full mt-2" disabled={saving}>
                {saving ? 'Saving…' : modal?.mode === 'add' ? addButtonLabel : 'Save Changes'}
              </Button>
            </form>
          </Modal>

          <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={`Delete ${typeLabel}`}>
            <p className="text-ink mb-1">
              Remove <strong>{deleteTarget ? itemLabel(deleteTarget) : ''}</strong> from {employeeName}&apos;s {typeLabel} records?
            </p>
            <p className="text-[0.86rem] text-ink-muted mb-5">This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
