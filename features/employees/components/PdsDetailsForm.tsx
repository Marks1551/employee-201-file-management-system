'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Plus, Trash2, Pencil, X, FileDown, Upload } from 'lucide-react';
import { Card, Button, Field, inputCls } from '@/shared/components/ui';
import RecordManager from '@/features/employees/components/RecordManager';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';
import { emptyPdsAddress, emptyPdsDetails } from '@/shared/types';
import { exportPds, parsePdsImportText } from '@/shared/lib/pds';
import type { Employee, PdsAddress, PdsChild, PdsDetails } from '@/shared/types';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const sectionTitle = 'text-[0.78rem] font-bold uppercase tracking-wide text-ink-faint mb-3 mt-0';

function AddressFields({ label, value, onChange, disabled }: { label: string; value: PdsAddress; onChange: (a: PdsAddress) => void; disabled?: boolean }) {
  function set(key: keyof PdsAddress, v: string) {
    onChange({ ...value, [key]: v || null });
  }
  return (
    <div className="mb-4">
      <p className="text-[0.82rem] font-semibold text-ink mb-2">{label}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="House/Block/Lot No."><input disabled={disabled} className={inputCls} value={value.houseBlockLot || ''} onChange={(e) => set('houseBlockLot', e.target.value)} /></Field>
        <Field label="Street"><input disabled={disabled} className={inputCls} value={value.street || ''} onChange={(e) => set('street', e.target.value)} /></Field>
        <Field label="Subdivision/Village"><input disabled={disabled} className={inputCls} value={value.subdivision || ''} onChange={(e) => set('subdivision', e.target.value)} /></Field>
        <Field label="Barangay"><input disabled={disabled} className={inputCls} value={value.barangay || ''} onChange={(e) => set('barangay', e.target.value)} /></Field>
        <Field label="City/Municipality"><input disabled={disabled} className={inputCls} value={value.cityMunicipality || ''} onChange={(e) => set('cityMunicipality', e.target.value)} /></Field>
        <Field label="Province"><input disabled={disabled} className={inputCls} value={value.province || ''} onChange={(e) => set('province', e.target.value)} /></Field>
        <Field label="ZIP Code"><input disabled={disabled} className={inputCls} value={value.zipCode || ''} onChange={(e) => set('zipCode', e.target.value)} /></Field>
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange, disabled }: { label: string; value: boolean | null; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border last:border-0">
      <p className="text-[0.86rem] text-ink m-0 flex-1">{label}</p>
      <div className="flex gap-2 shrink-0">
        <Button type="button" sm variant={value === true ? 'primary' : 'secondary'} disabled={disabled} onClick={() => onChange(true)}>Yes</Button>
        <Button type="button" sm variant={value === false ? 'primary' : 'secondary'} disabled={disabled} onClick={() => onChange(false)}>No</Button>
      </div>
    </div>
  );
}

interface Props {
  employee: Employee;
  readOnly?: boolean;
}

/**
 * Section II–VIII of CS Form 212 (Revised 2025) — everything about the
 * employee that isn't already covered by the core Personal Info / Employment
 * / Documents / Training / Educational Background / Work Experience tabs.
 * Scalar fields save as one JSON patch; eligibility, voluntary work, and
 * references are repeatable records managed the same way as Education etc.
 */
export default function PdsDetailsForm({ employee, readOnly = false }: Props) {
  const {
    updateEmployee,
    addCivilServiceEligibility, updateCivilServiceEligibility, deleteCivilServiceEligibility,
    addVoluntaryWork, updateVoluntaryWork, deleteVoluntaryWork,
    addPdsReference, updatePdsReference, deletePdsReference,
  } = useApp();
  const showToast = useToast();
  const [form, setForm] = useState<PdsDetails>({ ...emptyPdsDetails(), ...employee.pds });
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setForm({ ...emptyPdsDetails(), ...employee.pds });
  }, [employee.pds, editing]);

  function set<K extends keyof PdsDetails>(key: K, value: PdsDetails[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addChild() {
    setForm((f) => ({ ...f, children: [...f.children, { id: uid('child'), name: '', dob: null }] }));
  }
  function updateChild(id: string, patch: Partial<PdsChild>) {
    setForm((f) => ({ ...f, children: f.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }
  function removeChild(id: string) {
    setForm((f) => ({ ...f, children: f.children.filter((c) => c.id !== id) }));
  }

  async function handleSave() {
    setSaving(true);
    await updateEmployee(employee.id, { pds: form });
    setSaving(false);
    setEditing(false);
    showToast('PDS details saved.');
  }

  function handleEdit() {
    setForm({ ...emptyPdsDetails(), ...employee.pds });
    setEditing(true);
  }

  function handleCancel() {
    setForm({ ...emptyPdsDetails(), ...employee.pds });
    setEditing(false);
  }

  function handleExport() {
    exportPds(employee);
    showToast('Opening the Personal Data Sheet for export…');
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const imported = parsePdsImportText(text);
      if (Object.keys(imported).length === 0) {
        showToast('That file did not contain any recognizable PDS fields.');
        return;
      }
      setForm((f) => ({ ...f, ...imported }));
      setEditing(true);
      showToast('PDS data imported. Review the fields below, then save.');
    } catch {
      showToast('Could not read that file. Please choose a valid PDS JSON file.');
    }
  }

  const d = readOnly || !editing; // shorthand for `disabled`

  return (
    <div className="flex flex-col gap-6">
      <input ref={importInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />

      <div className="flex justify-end gap-2 flex-wrap">
        <Button type="button" variant="secondary" sm onClick={handleExport}>
          <FileDown size={14} />
          Export PDS
        </Button>
        {!readOnly && !editing && (
          <>
            <Button type="button" variant="secondary" sm onClick={handleImportClick}>
              <Upload size={14} />
              Import PDS
            </Button>
            <Button type="button" sm onClick={handleEdit}>
              <Pencil size={14} />
              Edit
            </Button>
          </>
        )}
      </div>

      <Card>
        <p className={sectionTitle}>Personal Information — Additional Details</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Name" hint="Set from the employee's core record — edit it from the Edit button on the 201 file header."><input disabled className={inputCls} value={employee.fullName} readOnly /></Field>
          <Field label="Name Extension"><input disabled={d} className={inputCls} placeholder="Jr., Sr., III" value={form.nameExtension || ''} onChange={(e) => set('nameExtension', e.target.value || null)} /></Field>
          <Field label="Sex at Birth"><input disabled={d} className={inputCls} value={form.sexAtBirth || ''} onChange={(e) => set('sexAtBirth', e.target.value || null)} /></Field>
          <Field label="Place of Birth"><input disabled={d} className={inputCls} value={form.placeOfBirth || ''} onChange={(e) => set('placeOfBirth', e.target.value || null)} /></Field>
          <Field label="Height (m)"><input disabled={d} className={inputCls} value={form.heightM || ''} onChange={(e) => set('heightM', e.target.value || null)} /></Field>
          <Field label="Weight (kg)"><input disabled={d} className={inputCls} value={form.weightKg || ''} onChange={(e) => set('weightKg', e.target.value || null)} /></Field>
          <Field label="Blood Type"><input disabled={d} className={inputCls} value={form.bloodType || ''} onChange={(e) => set('bloodType', e.target.value || null)} /></Field>
          <Field label="GSIS / UMID ID No."><input disabled={d} className={inputCls} value={form.gsisUmidNo || ''} onChange={(e) => set('gsisUmidNo', e.target.value || null)} /></Field>
          <Field label="Pag-IBIG ID No."><input disabled={d} className={inputCls} value={form.pagibigNo || ''} onChange={(e) => set('pagibigNo', e.target.value || null)} /></Field>
          <Field label="PhilHealth No."><input disabled={d} className={inputCls} value={form.philhealthNo || ''} onChange={(e) => set('philhealthNo', e.target.value || null)} /></Field>
          <Field label="PhilSys Number (PSN)"><input disabled={d} className={inputCls} value={form.philsysNumber || ''} onChange={(e) => set('philsysNumber', e.target.value || null)} /></Field>
          <Field label="TIN No."><input disabled={d} className={inputCls} value={form.tinNo || ''} onChange={(e) => set('tinNo', e.target.value || null)} /></Field>
          <Field label="Agency Employee No."><input disabled={d} className={inputCls} value={form.agencyEmployeeNo || ''} onChange={(e) => set('agencyEmployeeNo', e.target.value || null)} /></Field>
          <Field label="Dual Citizenship — Country" hint="If applicable"><input disabled={d} className={inputCls} value={form.dualCitizenshipCountry || ''} onChange={(e) => set('dualCitizenshipCountry', e.target.value || null)} /></Field>
          <Field label="Telephone No."><input disabled={d} className={inputCls} value={form.telephoneNo || ''} onChange={(e) => set('telephoneNo', e.target.value || null)} /></Field>
          <Field label="Mobile No."><input disabled={d} className={inputCls} value={form.mobileNo || ''} onChange={(e) => set('mobileNo', e.target.value || null)} /></Field>
        </div>
        <div className="mt-4">
          <AddressFields label="Residential Address" value={form.residentialAddress} onChange={(a) => set('residentialAddress', a)} disabled={d} />
          {!d && (
            <label className="flex items-center gap-2 text-[0.86rem] text-ink mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.permanentSameAsResidential}
                onChange={(e) => {
                  const same = e.target.checked;
                  set('permanentSameAsResidential', same);
                  if (same) set('permanentAddress', form.residentialAddress);
                }}
              />
              Permanent address is the same as residential address
            </label>
          )}
          {d && form.permanentSameAsResidential && (
            <p className="text-[0.82rem] text-ink-faint mb-3">Permanent address is the same as residential address.</p>
          )}
          {!form.permanentSameAsResidential && (
            <AddressFields label="Permanent Address" value={form.permanentAddress} onChange={(a) => set('permanentAddress', a)} disabled={d} />
          )}
        </div>
      </Card>

      <Card>
        <p className={sectionTitle}>II. Family Background</p>
        <p className="text-[0.82rem] font-semibold text-ink mb-2">Spouse</p>
        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <Field label="Surname"><input disabled={d} className={inputCls} value={form.spouseSurname || ''} onChange={(e) => set('spouseSurname', e.target.value || null)} /></Field>
          <Field label="First Name"><input disabled={d} className={inputCls} value={form.spouseFirstName || ''} onChange={(e) => set('spouseFirstName', e.target.value || null)} /></Field>
          <Field label="Middle Name"><input disabled={d} className={inputCls} value={form.spouseMiddleName || ''} onChange={(e) => set('spouseMiddleName', e.target.value || null)} /></Field>
          <Field label="Name Extension"><input disabled={d} className={inputCls} value={form.spouseNameExtension || ''} onChange={(e) => set('spouseNameExtension', e.target.value || null)} /></Field>
          <Field label="Occupation"><input disabled={d} className={inputCls} value={form.spouseOccupation || ''} onChange={(e) => set('spouseOccupation', e.target.value || null)} /></Field>
          <Field label="Employer / Business Name"><input disabled={d} className={inputCls} value={form.spouseEmployer || ''} onChange={(e) => set('spouseEmployer', e.target.value || null)} /></Field>
          <Field label="Business Address"><input disabled={d} className={inputCls} value={form.spouseBusinessAddress || ''} onChange={(e) => set('spouseBusinessAddress', e.target.value || null)} /></Field>
          <Field label="Telephone No."><input disabled={d} className={inputCls} value={form.spouseTelephone || ''} onChange={(e) => set('spouseTelephone', e.target.value || null)} /></Field>
        </div>

        <div className="flex items-center justify-between mb-2">
          <p className="text-[0.82rem] font-semibold text-ink m-0">Children</p>
          {!d && <Button type="button" variant="secondary" sm onClick={addChild}><Plus size={14} />Add Child</Button>}
        </div>
        {form.children.length === 0 && <p className="text-[0.82rem] text-ink-faint mb-4">No children on file.</p>}
        {form.children.map((c) => (
          <div key={c.id} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end mb-2">
            <Field label="Full Name"><input disabled={d} className={inputCls} value={c.name} onChange={(e) => updateChild(c.id, { name: e.target.value })} /></Field>
            <Field label="Date of Birth"><input disabled={d} className={inputCls} value={c.dob || ''} onChange={(e) => updateChild(c.id, { dob: e.target.value || null })} /></Field>
            {!d && <Button type="button" variant="danger" sm onClick={() => removeChild(c.id)}><Trash2 size={14} />Remove</Button>}
          </div>
        ))}

        <div className="grid gap-3 md:grid-cols-3 mt-4 mb-4">
          <p className="text-[0.82rem] font-semibold text-ink m-0 md:col-span-3">Father</p>
          <Field label="Surname"><input disabled={d} className={inputCls} value={form.fatherSurname || ''} onChange={(e) => set('fatherSurname', e.target.value || null)} /></Field>
          <Field label="First Name"><input disabled={d} className={inputCls} value={form.fatherFirstName || ''} onChange={(e) => set('fatherFirstName', e.target.value || null)} /></Field>
          <Field label="Middle Name"><input disabled={d} className={inputCls} value={form.fatherMiddleName || ''} onChange={(e) => set('fatherMiddleName', e.target.value || null)} /></Field>
          <Field label="Name Extension"><input disabled={d} className={inputCls} value={form.fatherNameExtension || ''} onChange={(e) => set('fatherNameExtension', e.target.value || null)} /></Field>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <p className="text-[0.82rem] font-semibold text-ink m-0 md:col-span-3">Mother&apos;s Maiden Name</p>
          <Field label="Surname"><input disabled={d} className={inputCls} value={form.motherMaidenSurname || ''} onChange={(e) => set('motherMaidenSurname', e.target.value || null)} /></Field>
          <Field label="First Name"><input disabled={d} className={inputCls} value={form.motherFirstName || ''} onChange={(e) => set('motherFirstName', e.target.value || null)} /></Field>
          <Field label="Middle Name"><input disabled={d} className={inputCls} value={form.motherMiddleName || ''} onChange={(e) => set('motherMiddleName', e.target.value || null)} /></Field>
        </div>
      </Card>

      <Card>
        <p className={sectionTitle}>IV. Civil Service Eligibility</p>
        <RecordManager
          items={employee.civilServiceEligibility}
          typeLabel="eligibility record"
          addButtonLabel="Add Eligibility"
          emptyMessage="No civil service eligibility on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.name}
          fields={[
            { key: 'name', label: 'Eligibility (CES/CSEE/Career Service/RA 1080/etc.)', required: true },
            { key: 'rating', label: 'Rating (if applicable)' },
            { key: 'examDate', label: 'Date of Examination / Conferment' },
            { key: 'examPlace', label: 'Place of Examination / Conferment' },
            { key: 'licenseNumber', label: 'License Number (if applicable)' },
            { key: 'licenseValidUntil', label: 'License Valid Until' },
          ]}
          emptyForm={{ name: '', rating: '', examDate: '', examPlace: '', licenseNumber: '', licenseValidUntil: '' }}
          columns={[
            { key: 'name', label: 'Eligibility' },
            { key: 'rating', label: 'Rating' },
            { key: 'examDate', label: 'Exam / Conferment Date' },
            { key: 'examPlace', label: 'Place' },
          ]}
          onAdd={(data) => addCivilServiceEligibility(employee.id, data)}
          onUpdate={(recordId, patch) => updateCivilServiceEligibility(employee.id, recordId, patch)}
          onDelete={(recordId) => deleteCivilServiceEligibility(employee.id, recordId)}
          readOnly={readOnly}
        />
      </Card>

      <Card>
        <p className={sectionTitle}>VI. Voluntary Work / Involvement</p>
        <RecordManager
          items={employee.voluntaryWork}
          typeLabel="voluntary work record"
          addButtonLabel="Add Voluntary Work"
          emptyMessage="No voluntary work on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.organization}
          fields={[
            { key: 'organization', label: 'Name & address of organization', required: true },
            { key: 'fromDate', label: 'From' },
            { key: 'toDate', label: 'To' },
            { key: 'hours', label: 'Number of hours' },
            { key: 'position', label: 'Position / nature of work' },
          ]}
          emptyForm={{ organization: '', fromDate: '', toDate: '', hours: '', position: '' }}
          columns={[
            { key: 'organization', label: 'Organization' },
            { key: 'fromDate', label: 'From' },
            { key: 'toDate', label: 'To' },
            { key: 'hours', label: 'Hours' },
            { key: 'position', label: 'Position' },
          ]}
          onAdd={(data) => addVoluntaryWork(employee.id, data)}
          onUpdate={(recordId, patch) => updateVoluntaryWork(employee.id, recordId, patch)}
          onDelete={(recordId) => deleteVoluntaryWork(employee.id, recordId)}
          readOnly={readOnly}
        />
      </Card>

      <Card>
        <p className={sectionTitle}>VIII. Other Information</p>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Special Skills and Hobbies"><textarea disabled={d} className={`${inputCls} min-h-[80px] py-2.5`} value={form.specialSkillsHobbies || ''} onChange={(e) => set('specialSkillsHobbies', e.target.value || null)} /></Field>
          <Field label="Non-Academic Distinctions / Recognition"><textarea disabled={d} className={`${inputCls} min-h-[80px] py-2.5`} value={form.nonAcademicDistinctions || ''} onChange={(e) => set('nonAcademicDistinctions', e.target.value || null)} /></Field>
          <Field label="Membership in Association / Organization"><textarea disabled={d} className={`${inputCls} min-h-[80px] py-2.5`} value={form.orgMemberships || ''} onChange={(e) => set('orgMemberships', e.target.value || null)} /></Field>
        </div>
      </Card>

      <Card>
        <p className={sectionTitle}>Declarations (Questions 34–40)</p>
        <YesNo disabled={d} label="34a. Related within the third degree to the appointing/recommending authority?" value={form.q34RelatedThirdDegree} onChange={(v) => set('q34RelatedThirdDegree', v)} />
        <YesNo disabled={d} label="34b. Related within the fourth degree (LGU career employees)?" value={form.q34RelatedFourthDegree} onChange={(v) => set('q34RelatedFourthDegree', v)} />
        {(form.q34RelatedThirdDegree || form.q34RelatedFourthDegree) && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q34Details || ''} onChange={(e) => set('q34Details', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="35a. Ever found guilty of any administrative offense?" value={form.q35aAdminOffense} onChange={(v) => set('q35aAdminOffense', v)} />
        {form.q35aAdminOffense && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q35aDetails || ''} onChange={(e) => set('q35aDetails', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="35b. Criminally charged before any court?" value={form.q35bCriminalCharge} onChange={(v) => set('q35bCriminalCharge', v)} />
        {form.q35bCriminalCharge && (
          <div className="grid gap-3 md:grid-cols-3 mb-3">
            <Field label="Details"><input disabled={d} className={inputCls} value={form.q35bDetails || ''} onChange={(e) => set('q35bDetails', e.target.value || null)} /></Field>
            <Field label="Date Filed"><input disabled={d} className={inputCls} value={form.q35bDateFiled || ''} onChange={(e) => set('q35bDateFiled', e.target.value || null)} /></Field>
            <Field label="Status of Case/s"><input disabled={d} className={inputCls} value={form.q35bStatus || ''} onChange={(e) => set('q35bStatus', e.target.value || null)} /></Field>
          </div>
        )}

        <YesNo disabled={d} label="36. Ever convicted of any crime or violation of law/decree/ordinance?" value={form.q36Convicted} onChange={(v) => set('q36Convicted', v)} />
        {form.q36Convicted && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q36Details || ''} onChange={(e) => set('q36Details', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="37. Ever separated from the service (resignation, retirement, dismissal, etc.)?" value={form.q37Separated} onChange={(v) => set('q37Separated', v)} />
        {form.q37Separated && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q37Details || ''} onChange={(e) => set('q37Details', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="38a. Ever a candidate in a national/local election (except Barangay)?" value={form.q38aCandidate} onChange={(v) => set('q38aCandidate', v)} />
        {form.q38aCandidate && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q38aDetails || ''} onChange={(e) => set('q38aDetails', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="38b. Resigned from government service to campaign for a candidate?" value={form.q38bResigned} onChange={(v) => set('q38bResigned', v)} />
        {form.q38bResigned && (
          <Field label="If YES, give details"><input disabled={d} className={inputCls} value={form.q38bDetails || ''} onChange={(e) => set('q38bDetails', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="39. Acquired status of immigrant/permanent resident of another country?" value={form.q39Immigrant} onChange={(v) => set('q39Immigrant', v)} />
        {form.q39Immigrant && (
          <Field label="If YES, country"><input disabled={d} className={inputCls} value={form.q39Country || ''} onChange={(e) => set('q39Country', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="40a. Member of any indigenous group?" value={form.q40aIndigenous} onChange={(v) => set('q40aIndigenous', v)} />
        {form.q40aIndigenous && (
          <Field label="Please specify"><input disabled={d} className={inputCls} value={form.q40aDetails || ''} onChange={(e) => set('q40aDetails', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="40b. Person with disability?" value={form.q40bPwd} onChange={(v) => set('q40bPwd', v)} />
        {form.q40bPwd && (
          <Field label="ID No."><input disabled={d} className={inputCls} value={form.q40bIdNo || ''} onChange={(e) => set('q40bIdNo', e.target.value || null)} /></Field>
        )}

        <YesNo disabled={d} label="40c. Solo parent?" value={form.q40cSoloParent} onChange={(v) => set('q40cSoloParent', v)} />
        {form.q40cSoloParent && (
          <Field label="ID No."><input disabled={d} className={inputCls} value={form.q40cIdNo || ''} onChange={(e) => set('q40cIdNo', e.target.value || null)} /></Field>
        )}
      </Card>

      <Card>
        <p className={sectionTitle}>41. References</p>
        <RecordManager
          items={employee.pdsReferences}
          typeLabel="reference"
          addButtonLabel="Add Reference"
          emptyMessage="No references on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.name}
          fields={[
            { key: 'name', label: 'Name', required: true },
            { key: 'address', label: 'Office / Residential Address' },
            { key: 'contact', label: 'Contact No. and/or Email' },
          ]}
          emptyForm={{ name: '', address: '', contact: '' }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'address', label: 'Address' },
            { key: 'contact', label: 'Contact' },
          ]}
          onAdd={(data) => addPdsReference(employee.id, data)}
          onUpdate={(recordId, patch) => updatePdsReference(employee.id, recordId, patch)}
          onDelete={(recordId) => deletePdsReference(employee.id, recordId)}
          readOnly={readOnly}
        />
      </Card>

      <Card>
        <p className={sectionTitle}>Government Issued ID (for signature block)</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="ID Type" hint="Passport, GSIS, SSS, PRC, Driver's License, etc."><input disabled={d} className={inputCls} value={form.govIdType || ''} onChange={(e) => set('govIdType', e.target.value || null)} /></Field>
          <Field label="ID / License / Passport No."><input disabled={d} className={inputCls} value={form.govIdNumber || ''} onChange={(e) => set('govIdNumber', e.target.value || null)} /></Field>
          <Field label="Date of Issuance"><input disabled={d} className={inputCls} value={form.govIdDateIssued || ''} onChange={(e) => set('govIdDateIssued', e.target.value || null)} /></Field>
          <Field label="Place of Issuance"><input disabled={d} className={inputCls} value={form.govIdPlaceIssued || ''} onChange={(e) => set('govIdPlaceIssued', e.target.value || null)} /></Field>
        </div>
      </Card>

      {!readOnly && editing && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
            <X size={16} />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save PDS Details'}</Button>
        </div>
      )}
    </div>
  );
}
