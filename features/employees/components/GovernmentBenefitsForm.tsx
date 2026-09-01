'use client';

import { useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { Card, Button, Field, inputCls } from '@/shared/components/ui';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { emptyPdsDetails } from '@/shared/types';
import type { Employee, PdsDetails } from '@/shared/types';

interface Props {
  employee: Employee;
  readOnly?: boolean;
}

type BenefitsFields = Pick<
  PdsDetails,
  'gsisUmidNo' | 'pagibigNo' | 'philhealthNo' | 'philsysNumber' | 'tinNo' | 'agencyEmployeeNo'
>;

function pickBenefits(pds: Partial<PdsDetails>): BenefitsFields {
  const base = emptyPdsDetails();
  return {
    gsisUmidNo: pds.gsisUmidNo ?? base.gsisUmidNo,
    pagibigNo: pds.pagibigNo ?? base.pagibigNo,
    philhealthNo: pds.philhealthNo ?? base.philhealthNo,
    philsysNumber: pds.philsysNumber ?? base.philsysNumber,
    tinNo: pds.tinNo ?? base.tinNo,
    agencyEmployeeNo: pds.agencyEmployeeNo ?? base.agencyEmployeeNo,
  };
}

/**
 * Quick-access view/edit of the government membership numbers that also
 * live inside the PDS Details form (Section I). Kept in sync with the same
 * `employee.pds` fields — editing here or in PDS Details updates the same
 * data, just without paging through the full CS Form 212 layout.
 */
export default function GovernmentBenefitsForm({ employee, readOnly = false }: Props) {
  const { updateEmployee } = useApp();
  const showToast = useToast();
  const [form, setForm] = useState<BenefitsFields>(pickBenefits(employee.pds));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setForm(pickBenefits(employee.pds));
  }, [employee.pds, editing]);

  function set<K extends keyof BenefitsFields>(key: K, value: BenefitsFields[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleEdit() {
    setForm(pickBenefits(employee.pds));
    setEditing(true);
  }

  function handleCancel() {
    setForm(pickBenefits(employee.pds));
    setEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    await updateEmployee(employee.id, { pds: { ...employee.pds, ...form } });
    setSaving(false);
    setEditing(false);
    showToast('Government benefits saved.');
  }

  const d = readOnly || !editing;

  return (
    <div className="flex flex-col gap-6">
      {!readOnly && (
        <div className="flex justify-end gap-2">
          {!editing ? (
            <Button type="button" sm onClick={handleEdit}>
              <Pencil size={14} />
              Edit
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" sm onClick={handleCancel} disabled={saving}>
                <X size={14} />
                Cancel
              </Button>
              <Button type="button" sm onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </>
          )}
        </div>
      )}

      <Card>
        <p className="text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-3 mt-0">Government Membership IDs</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="GSIS / UMID ID No."><input disabled={d} className={inputCls} value={form.gsisUmidNo || ''} onChange={(e) => set('gsisUmidNo', e.target.value || null)} /></Field>
          <Field label="Pag-IBIG ID No."><input disabled={d} className={inputCls} value={form.pagibigNo || ''} onChange={(e) => set('pagibigNo', e.target.value || null)} /></Field>
          <Field label="PhilHealth No."><input disabled={d} className={inputCls} value={form.philhealthNo || ''} onChange={(e) => set('philhealthNo', e.target.value || null)} /></Field>
          <Field label="PhilSys Number (PSN)"><input disabled={d} className={inputCls} value={form.philsysNumber || ''} onChange={(e) => set('philsysNumber', e.target.value || null)} /></Field>
          <Field label="TIN No."><input disabled={d} className={inputCls} value={form.tinNo || ''} onChange={(e) => set('tinNo', e.target.value || null)} /></Field>
          <Field label="Agency Employee No."><input disabled={d} className={inputCls} value={form.agencyEmployeeNo || ''} onChange={(e) => set('agencyEmployeeNo', e.target.value || null)} /></Field>
        </div>
        <p className="text-[0.8rem] text-ink-faint mt-3 mb-0">
          These numbers are shared with Section I of the PDS Details tab — updating them here updates them there too.
        </p>
      </Card>
    </div>
  );
}
