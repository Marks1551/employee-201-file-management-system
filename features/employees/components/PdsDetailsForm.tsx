"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Plus, Trash2, Pencil, X, FileDown, Upload, Printer } from "lucide-react";
import { Button } from "@/shared/components/ui";
import RecordManager from "@/features/employees/components/RecordManager";
import SkeletonImage from "@/shared/components/SkeletonImage";
import {
  AddressBlock,
  Captioned,
  Check,
  ContinueNote,
  Detail,
  LABEL_BG,
  LINE,
  Pick,
  QRow,
  Row,
  SectionBar,
  Sheet,
  SheetHeader,
  SignatureRow,
  Txt,
  YesNo,
  fmtDMY,
  thCls,
} from "@/features/employees/components/PdsSheet";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";
import { emptyPdsDetails } from "@/shared/types";
import { exportPds, parsePdsImportText } from "@/shared/lib/pds";
import { exportPdsWorkbook } from "@/shared/lib/pdsWorkbook";
import { PDS_COUNTRIES } from "@/shared/lib/pdsCountries";
import type { Employee, PdsChild, PdsDetails } from "@/shared/types";

/** Civil status choices on CS Form 212 (Revised 2026), item 6. */
const CIVIL_STATUS_OPTIONS = ["Single", "Married", "Widowed", "Separated", "Others"];

const EDUCATION_LEVELS = ["Elementary", "Secondary", "Vocational / Trade", "College", "Graduate Studies"];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Props {
  employee: Employee;
  readOnly?: boolean;
  /** Faculty can add and edit their trainings but only HR can archive them. */
  canArchiveTraining?: boolean;
}

/**
 * Section II–VIII of CS Form 212 (Revised 2026) — everything about the
 * employee that isn't already covered by the core Personal Info / Employment
 * / Documents / Training / Educational Background / Work Experience tabs.
 * Scalar fields save as one JSON patch; eligibility, voluntary work, and
 * references are repeatable records managed the same way as Education etc.
 */
export default function PdsDetailsForm({ employee, readOnly = false, canArchiveTraining = true }: Props) {
  const {
    updateEmployee,
    addCivilServiceEligibility,
    updateCivilServiceEligibility,
    deleteCivilServiceEligibility,
    addVoluntaryWork,
    updateVoluntaryWork,
    deleteVoluntaryWork,
    addPdsReference,
    updatePdsReference,
    deletePdsReference,
    addEducation,
    updateEducation,
    archiveEducation,
    addWorkExperience,
    updateWorkExperience,
    archiveWorkExperience,
    addTraining,
    updateTraining,
    archiveTraining,
    currentUser,
  } = useApp();
  const showToast = useToast();
  // HR/admin can edit every field on the PDS, including the employee's name and the core
  // personal details. Faculty can edit their own PDS details but never their name — and the
  // server enforces that too.
  const canEditCore = currentUser?.role === "hr" || currentUser?.role === "admin";
  const coreFrom = (e: Employee) => ({
    dob: e.dob,
    civilStatus: e.civilStatus,
    nationality: e.nationality,
    email: e.email,
  });
  const [form, setForm] = useState<PdsDetails>({ ...emptyPdsDetails(), ...employee.pds });
  const [core, setCore] = useState(coreFrom(employee));
  const [saving, setSaving] = useState(false);
  // Faculty must certify their PDS entries before saving (HR editing on someone's behalf doesn't).
  const needsCertification = currentUser?.role === "faculty";
  const [certified, setCertified] = useState(false);
  const [editing, setEditing] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setForm({ ...emptyPdsDetails(), ...employee.pds });
      setCore(coreFrom(employee));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee, editing]);

  function set<K extends keyof PdsDetails>(key: K, value: PdsDetails[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addChild() {
    setForm((f) => ({ ...f, children: [...f.children, { id: uid("child"), name: "", dob: null }] }));
  }
  function updateChild(id: string, patch: Partial<PdsChild>) {
    setForm((f) => ({ ...f, children: f.children.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  }
  function removeChild(id: string) {
    setForm((f) => ({ ...f, children: f.children.filter((c) => c.id !== id) }));
  }

  async function handleSave() {
    if (needsCertification && !certified) {
      showToast("Please tick the certification before saving.", "error");
      return;
    }
    if (canEditCore && (!(form.firstName || "").trim() || !(form.lastName || "").trim())) {
      showToast("First name and surname are required.", "error");
      return;
    }
    setSaving(true);
    const pdsOut = form.permanentSameAsResidential ? { ...form, permanentAddress: form.residentialAddress } : form;
    const result = await updateEmployee(employee.id, canEditCore ? { pds: pdsOut, ...core } : { pds: pdsOut });
    setSaving(false);
    if (!result.ok) {
      showToast(result.error || "Could not save your PDS details. Please try again.", "error");
      return;
    }
    setEditing(false);
    setCertified(false);
    showToast("PDS details saved.");
  }

  function handleEdit() {
    setForm({ ...emptyPdsDetails(), ...employee.pds });
    setCore(coreFrom(employee));
    setCertified(false);
    setEditing(true);
  }

  function handleCancel() {
    setForm({ ...emptyPdsDetails(), ...employee.pds });
    setCore(coreFrom(employee));
    setCertified(false);
    setEditing(false);
  }

  /** Downloads the PDS as the official CS Form 212 (Revised 2026) Excel file — same layout as the form. */
  async function handleExport() {
    try {
      showToast("Preparing the Personal Data Sheet…");
      await exportPdsWorkbook(employee);
    } catch {
      showToast("Could not export the Personal Data Sheet. Please try again.");
    }
  }

  function handlePrint() {
    exportPds(employee);
    showToast("Opening the Personal Data Sheet for printing…");
  }

  function handleImportClick() {
    importInputRef.current?.click();
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
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
      setForm((f) => ({ ...f, ...imported }));
      setEditing(true);
      showToast("PDS data imported. Review the fields below, then save.");
    } catch {
      showToast("Could not read that file. Please choose a valid PDS JSON file.");
    }
  }

  const d = readOnly || !editing; // shorthand for `disabled`

  // ---- values derived for the sheet layout -------------------------------------------------
  const dn = d || !canEditCore; // identity fields: only HR/admin may change them
  const filipino = /^filipino$/i.test((core.nationality || "").trim());
  const dualOn = !!(form.dualCitizenshipBasis || form.dualCitizenshipCountry);
  const sameAddr = form.permanentSameAsResidential;
  const levelIdx = (l: string | null) => {
    const i = EDUCATION_LEVELS.indexOf(l || "");
    return i < 0 ? EDUCATION_LEVELS.length : i;
  };
  const sortedEducation = [...employee.education].sort((a, b) => levelIdx(a.level) - levelIdx(b.level));
  const childBlanks = Math.max(0, 10 - form.children.length);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="flex justify-end gap-2 flex-wrap">
        <Button type="button" variant="secondary" sm onClick={handleExport}>
          <FileDown size={14} />
          Export PDS (.xlsx)
        </Button>
        <Button type="button" variant="secondary" sm onClick={handlePrint}>
          <Printer size={14} />
          Print PDS
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

      {!readOnly && editing && (
        <div className="rounded-lg border border-warn-border bg-warn-bg px-4 py-2.5 text-[0.86rem] text-warn-text">
          <strong>Editing the Personal Data Sheet.</strong> Click a yellow cell to fill it in, tick the boxes that
          apply, then press <strong>Save PDS Details</strong> at the bottom. Tables (education, work experience, etc.)
          are edited with the pencil icons beside each row.
        </div>
      )}

      {/* ===================== PAGE 1 ===================== */}
      <Sheet page={1}>
        <SheetHeader />

        <SectionBar>I. PERSONAL INFORMATION</SectionBar>
        <Row n="1." label="SURNAME" labelW="w-[19%]">
          <Txt value={form.lastName} onChange={(v) => set("lastName", v)} disabled={dn} />
        </Row>
        <Row n="2." label="FIRST NAME" labelW="w-[19%]">
          <Txt value={form.firstName} onChange={(v) => set("firstName", v)} disabled={dn} />
          <Captioned caption="NAME EXTENSION (JR., SR)" className="w-[30%] shrink-0">
            <Txt value={form.nameExtension} onChange={(v) => set("nameExtension", v)} disabled={dn} />
          </Captioned>
        </Row>
        <Row label="MIDDLE NAME" labelW="w-[19%]">
          <Txt value={form.middleName} onChange={(v) => set("middleName", v)} disabled={dn} />
        </Row>

        <div className="grid grid-cols-2">
          {/* ---- left: items 3–15 ---- */}
          <div className={`flex flex-col border-r ${LINE}`}>
            <Row n="3." label="DATE OF BIRTH (dd/mm/yyyy)">
              <Txt
                kind="date"
                max={today}
                value={core.dob}
                onChange={(v) => setCore((c) => ({ ...c, dob: v || "" }))}
                disabled={dn}
              />
            </Row>
            <Row n="4." label="PLACE OF BIRTH">
              <Txt value={form.placeOfBirth} onChange={(v) => set("placeOfBirth", v)} disabled={d} />
            </Row>
            <Row n="5." label="SEX AT BIRTH">
              <div className="flex flex-1 items-center gap-6 px-2">
                {["Male", "Female"].map((o) => (
                  <Check
                    key={o}
                    label={o}
                    checked={form.sexAtBirth === o}
                    disabled={d}
                    onChange={() => set("sexAtBirth", form.sexAtBirth === o ? null : o)}
                  />
                ))}
              </div>
            </Row>
            <Row n="6." label="CIVIL STATUS" className="min-h-[66px]">
              <div className="grid flex-1 grid-cols-2 content-center gap-x-3 gap-y-1.5 px-2 py-1.5">
                {CIVIL_STATUS_OPTIONS.map((o) => (
                  <Check
                    key={o}
                    label={o === "Others" ? "Other/s:" : o}
                    checked={core.civilStatus === o}
                    disabled={dn}
                    onChange={() => setCore((c) => ({ ...c, civilStatus: c.civilStatus === o ? null : o }))}
                  />
                ))}
                {core.civilStatus && !CIVIL_STATUS_OPTIONS.includes(core.civilStatus) && (
                  <Check label={core.civilStatus} checked disabled />
                )}
              </div>
            </Row>
            <Row n="7." label="HEIGHT (m)">
              <Txt value={form.heightM} onChange={(v) => set("heightM", v)} disabled={d} />
            </Row>
            <Row n="8." label="WEIGHT (kg)">
              <Txt value={form.weightKg} onChange={(v) => set("weightKg", v)} disabled={d} />
            </Row>
            <Row n="9." label="BLOOD TYPE">
              <Txt value={form.bloodType} onChange={(v) => set("bloodType", v)} disabled={d} />
            </Row>
            <Row n="10." label="UMID ID NO.">
              <Txt value={form.gsisUmidNo} onChange={(v) => set("gsisUmidNo", v)} disabled={d} />
            </Row>
            <Row n="11." label="PAG-IBIG ID NO.">
              <Txt value={form.pagibigNo} onChange={(v) => set("pagibigNo", v)} disabled={d} />
            </Row>
            <Row n="12." label="PHILHEALTH NO.">
              <Txt value={form.philhealthNo} onChange={(v) => set("philhealthNo", v)} disabled={d} />
            </Row>
            <Row n="13." label="PhilSys Card Number (PCN):">
              <Txt value={form.philsysNumber} onChange={(v) => set("philsysNumber", v)} disabled={d} />
            </Row>
            <Row n="14." label="TIN NO.">
              <Txt value={form.tinNo} onChange={(v) => set("tinNo", v)} disabled={d} />
            </Row>
            <Row n="15." label="AGENCY EMPLOYEE NO." className="flex-1">
              <Txt value={form.agencyEmployeeNo} onChange={(v) => set("agencyEmployeeNo", v)} disabled={d} />
            </Row>
          </div>

          {/* ---- right: items 16–21 ---- */}
          <div className="flex flex-col">
            <div className={`flex border-b ${LINE}`}>
              <div
                className={`w-[34%] shrink-0 border-r ${LINE} ${LABEL_BG} px-2 py-1 text-[10.5px] uppercase leading-tight`}
              >
                <div>
                  <span className="mr-1.5">16.</span>CITIZENSHIP
                </div>
                <div className="mt-3 normal-case">If holder of dual citizenship, please indicate the details.</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2 px-2 py-1.5">
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  <Check
                    label="Filipino"
                    checked={filipino}
                    disabled={dn}
                    onChange={(on) => setCore((c) => ({ ...c, nationality: on ? "Filipino" : null }))}
                  />
                  <Check
                    label="Dual Citizenship"
                    checked={dualOn}
                    disabled={d}
                    onChange={(on) => {
                      set("dualCitizenshipBasis", on ? "by birth" : null);
                      if (!on) set("dualCitizenshipCountry", null);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 pl-5">
                  {["by birth", "by naturalization"].map((o) => (
                    <Check
                      key={o}
                      label={o}
                      checked={form.dualCitizenshipBasis === o}
                      disabled={d || !dualOn}
                      onChange={() => set("dualCitizenshipBasis", o)}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pl-5">
                  <span className="shrink-0 text-[11.5px]">Pls. indicate country:</span>
                  <Pick
                    value={form.dualCitizenshipCountry}
                    onChange={(v) => set("dualCitizenshipCountry", v)}
                    disabled={d || !dualOn}
                    options={PDS_COUNTRIES}
                    className={`border-b ${LINE}`}
                  />
                </div>
                {!filipino && (editing || core.nationality) && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[11.5px]">Citizenship (if not Filipino):</span>
                    <Txt
                      value={core.nationality}
                      onChange={(v) => setCore((c) => ({ ...c, nationality: v }))}
                      disabled={dn}
                      className={`border-b ${LINE}`}
                    />
                  </div>
                )}
              </div>
            </div>

            <AddressBlock
              n="17."
              label="RESIDENTIAL ADDRESS"
              value={form.residentialAddress}
              onChange={(k, v) => set("residentialAddress", { ...form.residentialAddress, [k]: v })}
              disabled={d}
            />
            <AddressBlock
              n="18."
              label="PERMANENT ADDRESS"
              value={sameAddr ? form.residentialAddress : form.permanentAddress}
              onChange={(k, v) => set("permanentAddress", { ...form.permanentAddress, [k]: v })}
              disabled={d || sameAddr}
              extraLabel={
                !readOnly && (editing || sameAddr) ? (
                  <Check
                    label="Same as residential"
                    checked={sameAddr}
                    disabled={d}
                    onChange={(same) => {
                      set("permanentSameAsResidential", same);
                      if (same) set("permanentAddress", form.residentialAddress);
                    }}
                  />
                ) : undefined
              }
            />
            <Row n="19." label="TELEPHONE NO." labelW="w-[34%]">
              <Txt value={form.telephoneNo} onChange={(v) => set("telephoneNo", v)} disabled={d} />
            </Row>
            <Row n="20." label="MOBILE NO." labelW="w-[34%]">
              <Txt value={form.mobileNo ?? employee.contact ?? ""} onChange={(v) => set("mobileNo", v)} disabled={d} />
            </Row>
            <Row n="21." label="E-MAIL ADDRESS (if any)" labelW="w-[34%]" className="flex-1">
              <Txt
                kind="email"
                value={core.email}
                onChange={(v) => setCore((c) => ({ ...c, email: v }))}
                disabled={dn}
              />
            </Row>
          </div>
        </div>

        <SectionBar>II. FAMILY BACKGROUND</SectionBar>
        <div className="grid grid-cols-2">
          <div className={`border-r ${LINE}`}>
            <Row n="22." label="SPOUSE'S SURNAME">
              <Txt value={form.spouseSurname} onChange={(v) => set("spouseSurname", v)} disabled={d} />
            </Row>
            <Row label="FIRST NAME" labelW="w-[38%]">
              <Txt value={form.spouseFirstName} onChange={(v) => set("spouseFirstName", v)} disabled={d} />
              <Captioned caption="NAME EXTENSION (JR., SR)" className="w-[34%] shrink-0">
                <Txt value={form.spouseNameExtension} onChange={(v) => set("spouseNameExtension", v)} disabled={d} />
              </Captioned>
            </Row>
            <Row label="MIDDLE NAME">
              <Txt value={form.spouseMiddleName} onChange={(v) => set("spouseMiddleName", v)} disabled={d} />
            </Row>
            <Row label="OCCUPATION">
              <Txt value={form.spouseOccupation} onChange={(v) => set("spouseOccupation", v)} disabled={d} />
            </Row>
            <Row label="EMPLOYER/BUSINESS NAME">
              <Txt value={form.spouseEmployer} onChange={(v) => set("spouseEmployer", v)} disabled={d} />
            </Row>
            <Row label="BUSINESS ADDRESS">
              <Txt value={form.spouseBusinessAddress} onChange={(v) => set("spouseBusinessAddress", v)} disabled={d} />
            </Row>
            <Row label="TELEPHONE NO.">
              <Txt value={form.spouseTelephone} onChange={(v) => set("spouseTelephone", v)} disabled={d} />
            </Row>

            <Row n="24." label="FATHER'S SURNAME">
              <Txt value={form.fatherSurname} onChange={(v) => set("fatherSurname", v)} disabled={d} />
            </Row>
            <Row label="FIRST NAME">
              <Txt value={form.fatherFirstName} onChange={(v) => set("fatherFirstName", v)} disabled={d} />
              <Captioned caption="NAME EXTENSION (JR., SR)" className="w-[34%] shrink-0">
                <Txt value={form.fatherNameExtension} onChange={(v) => set("fatherNameExtension", v)} disabled={d} />
              </Captioned>
            </Row>
            <Row label="MIDDLE NAME">
              <Txt value={form.fatherMiddleName} onChange={(v) => set("fatherMiddleName", v)} disabled={d} />
            </Row>

            <div
              className={`flex min-h-[30px] items-center gap-1.5 border-b ${LINE} ${LABEL_BG} px-2 py-1 text-[10.5px] uppercase`}
            >
              <span className="w-4 shrink-0">25.</span>
              MOTHER&apos;S MAIDEN NAME
            </div>
            <Row label="SURNAME">
              <Txt value={form.motherMaidenSurname} onChange={(v) => set("motherMaidenSurname", v)} disabled={d} />
            </Row>
            <Row label="FIRST NAME">
              <Txt value={form.motherFirstName} onChange={(v) => set("motherFirstName", v)} disabled={d} />
            </Row>
            <Row label="MIDDLE NAME" className="border-b-0">
              <Txt value={form.motherMiddleName} onChange={(v) => set("motherMiddleName", v)} disabled={d} />
            </Row>
          </div>

          {/* 23. children */}
          <div className="flex flex-col">
            <div className={`flex border-b ${LINE} ${LABEL_BG} text-[10.5px] uppercase leading-tight`}>
              <div className={`flex-1 border-r ${LINE} px-2 py-1.5`}>
                <span className="mr-1.5">23.</span>NAME of CHILDREN{" "}
                <span className="normal-case">(Write full name and list all)</span>
              </div>
              <div className="w-[34%] px-2 py-1.5 text-center">DATE OF BIRTH (dd/mm/yyyy)</div>
              {!d && <div className="w-8" />}
            </div>
            {form.children.map((c) => (
              <div key={c.id} className={`flex min-h-[30px] border-b ${LINE}`}>
                <div className={`flex flex-1 border-r ${LINE}`}>
                  <Txt value={c.name} onChange={(v) => updateChild(c.id, { name: v || "" })} disabled={d} />
                </div>
                <div className="flex w-[34%]">
                  <Txt kind="dateDMY" value={c.dob} onChange={(v) => updateChild(c.id, { dob: v })} disabled={d} />
                </div>
                {!d && (
                  <button
                    type="button"
                    title="Remove child"
                    aria-label="Remove child"
                    onClick={() => removeChild(c.id)}
                    className="flex w-8 cursor-pointer items-center justify-center text-danger-text hover:bg-danger-bg"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            {Array.from({ length: childBlanks }).map((_, i) => (
              <div key={`cb-${i}`} className={`flex min-h-[30px] border-b ${LINE}`}>
                <div className={`flex-1 border-r ${LINE}`} />
                <div className="w-[34%]" />
                {!d && <div className="w-8" />}
              </div>
            ))}
            {!d && (
              <div className={`flex justify-end border-b ${LINE} bg-amber-50 px-2 py-1`}>
                <button
                  type="button"
                  onClick={addChild}
                  className="inline-flex cursor-pointer items-center gap-1 rounded border border-neutral-700 bg-white px-2 py-0.5 text-[11.5px] font-semibold text-black hover:bg-neutral-100"
                >
                  <Plus size={13} />
                  Add Child
                </button>
              </div>
            )}
            <div className="flex-1" />
            <ContinueNote sheet="C7" />
          </div>
        </div>

        <SectionBar>III. EDUCATIONAL BACKGROUND</SectionBar>
        <RecordManager
          items={sortedEducation}
          typeLabel="education record"
          addButtonLabel="Add Education"
          emptyMessage="No educational background on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.schoolName}
          fields={[
            {
              key: "level",
              label: "Level",
              type: "select",
              options: ["Elementary", "Secondary", "Vocational / Trade", "College", "Graduate Studies"],
            },
            { key: "schoolName", label: "Name of school (write in full)", required: true },
            {
              key: "degree",
              label: "Basic education / degree / course (write in full)",
              hint: "e.g. BS Computer Science",
            },
            { key: "periodFrom", label: "Period of attendance — From (yyyy)", hint: "e.g. 2011" },
            { key: "periodTo", label: "Period of attendance — To (yyyy)", hint: "e.g. 2015" },
            { key: "highestLevelUnits", label: "Highest level / units earned (if not graduated)" },
            { key: "yearGraduated", label: "Year graduated", hint: "e.g. 2015" },
            { key: "honors", label: "Scholarship / academic honors received", hint: "e.g. Cum Laude (optional)" },
          ]}
          emptyForm={{
            level: "College",
            schoolName: "",
            degree: "",
            periodFrom: "",
            periodTo: "",
            highestLevelUnits: "",
            yearGraduated: "",
            honors: "",
          }}
          columns={[
            { key: "level", label: "" },
            { key: "schoolName", label: "" },
            { key: "degree", label: "" },
            { key: "periodFrom", label: "" },
            { key: "periodTo", label: "" },
            { key: "highestLevelUnits", label: "" },
            { key: "yearGraduated", label: "" },
            { key: "honors", label: "" },
          ]}
          formStyle={{
            widths: [12, 20, 20, 6, 6, 12, 8, 16],
            headRows: 2,
            minRows: 5,
            continueSheet: "C8",
            head: (action) => (
              <>
                <tr>
                  <th rowSpan={2} className={thCls}>
                    26. LEVEL
                  </th>
                  <th rowSpan={2} className={thCls}>
                    NAME OF SCHOOL
                    <br />
                    (Write in full)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    BASIC EDUCATION/DEGREE/COURSE
                    <br />
                    (Write in full)
                  </th>
                  <th colSpan={2} className={thCls}>
                    PERIOD OF ATTENDANCE (yyyy)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    HIGHEST LEVEL/ UNITS EARNED (if not graduated)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    YEAR GRADUATED
                  </th>
                  <th rowSpan={2} className={thCls}>
                    SCHOLARSHIP/ ACADEMIC HONORS RECEIVED
                  </th>
                  {action}
                </tr>
                <tr>
                  <th className={thCls}>From</th>
                  <th className={thCls}>To</th>
                </tr>
              </>
            ),
          }}
          onAdd={(data) => addEducation(employee.id, data)}
          onUpdate={(recordId, patch) => updateEducation(employee.id, recordId, patch)}
          archive
          onDelete={(recordId) => archiveEducation(employee.id, recordId)}
          readOnly={readOnly}
        />
        <SignatureRow />
      </Sheet>

      {/* ===================== PAGE 2 ===================== */}
      <Sheet page={2}>
        <SectionBar>IV. CIVIL SERVICE ELIGIBILITY</SectionBar>
        <RecordManager
          items={employee.civilServiceEligibility}
          typeLabel="eligibility record"
          addButtonLabel="Add Eligibility"
          emptyMessage="No civil service eligibility on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.name}
          fields={[
            { key: "name", label: "Eligibility (CES/CSEE/Career Service/RA 1080/etc.)", required: true },
            { key: "rating", label: "Rating (if applicable)" },
            { key: "examDate", label: "Date of Examination / Conferment", type: "date" },
            { key: "examPlace", label: "Place of Examination / Conferment" },
            { key: "licenseNumber", label: "License Number (if applicable)" },
            { key: "licenseValidUntil", label: "License Date of Validity", type: "date" },
          ]}
          emptyForm={{ name: "", rating: "", examDate: "", examPlace: "", licenseNumber: "", licenseValidUntil: "" }}
          columns={[
            { key: "name", label: "" },
            { key: "rating", label: "" },
            { key: "examDate", label: "", render: (r) => fmtDMY(r.examDate) },
            { key: "examPlace", label: "" },
            { key: "licenseNumber", label: "" },
            { key: "licenseValidUntil", label: "", render: (r) => fmtDMY(r.licenseValidUntil) },
          ]}
          formStyle={{
            widths: [30, 10, 13, 25, 12, 10],
            headRows: 2,
            minRows: 5,
            continueSheet: "C9",
            head: (action) => (
              <>
                <tr>
                  <th rowSpan={2} className={thCls}>
                    27. CAREER SERVICE/ RA 1080 (BOARD/ BAR) UNDER SPECIAL LAWS/ CES/ CSEE BARANGAY ELIGIBILITY /
                    DRIVER&apos;S LICENSE
                  </th>
                  <th rowSpan={2} className={thCls}>
                    RATING
                    <br />
                    (If Applicable)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    DATE OF EXAMINATION / CONFERMENT
                  </th>
                  <th rowSpan={2} className={thCls}>
                    PLACE OF EXAMINATION / CONFERMENT
                  </th>
                  <th colSpan={2} className={thCls}>
                    LICENSE (if applicable)
                  </th>
                  {action}
                </tr>
                <tr>
                  <th className={thCls}>NUMBER</th>
                  <th className={thCls}>Date of Validity</th>
                </tr>
              </>
            ),
          }}
          onAdd={(data) => addCivilServiceEligibility(employee.id, data)}
          onUpdate={(recordId, patch) => updateCivilServiceEligibility(employee.id, recordId, patch)}
          onDelete={(recordId) => deleteCivilServiceEligibility(employee.id, recordId)}
          readOnly={readOnly}
        />
        <SectionBar note="(Include private employment. Start from your recent work) Description of duties should be indicated in the attached Work Experience sheet.">
          V. WORK EXPERIENCE
        </SectionBar>
        <RecordManager
          items={employee.workExperience}
          typeLabel="work experience record"
          addButtonLabel="Add Work Experience"
          emptyMessage="No prior work experience on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => `${r.position ? `${r.position} at ` : ""}${r.company}`}
          fields={[
            { key: "company", label: "Company / employer", required: true },
            { key: "position", label: "Position" },
            { key: "fromDate", label: "From", type: "date" },
            { key: "toDate", label: "To", type: "date", hint: "Leave blank if current" },
            { key: "monthlySalary", label: "Monthly salary" },
            {
              key: "salaryGrade",
              label: "Salary / job / pay grade & step increment",
              hint: 'Format "00-0" (if applicable)',
            },
            {
              key: "statusOfAppointment",
              label: "Status of Appointment",
              hint: "e.g. Permanent, Contractual, Casual",
            },
            {
              key: "govtService",
              label: "Government Service?",
              type: "select",
              options: [
                { value: "", label: "—" },
                { value: "Y", label: "Yes" },
                { value: "N", label: "No" },
              ],
            },
            {
              key: "description",
              label: "Description",
              type: "textarea",
              hint: "Key responsibilities (optional)",
            },
          ]}
          emptyForm={{
            company: "",
            position: "",
            fromDate: "",
            toDate: "",
            monthlySalary: "",
            salaryGrade: "",
            statusOfAppointment: "",
            govtService: "",
            description: "",
          }}
          columns={[
            { key: "fromDate", label: "", render: (r) => fmtDMY(r.fromDate) },
            { key: "toDate", label: "", render: (r) => (r.toDate ? fmtDMY(r.toDate) : "Present") },
            { key: "position", label: "" },
            { key: "company", label: "" },
            { key: "monthlySalary", label: "" },
            { key: "salaryGrade", label: "" },
            { key: "statusOfAppointment", label: "" },
            { key: "govtService", label: "" },
          ]}
          formStyle={{
            widths: [8, 8, 19, 25, 9, 12, 12, 7],
            headRows: 2,
            minRows: 6,
            continueSheet: "C6",
            head: (action) => (
              <>
                <tr>
                  <th colSpan={2} className={thCls}>
                    28. INCLUSIVE DATES (dd/mm/yyyy)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    POSITION TITLE
                    <br />
                    (Write in full/Do not abbreviate)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    DEPARTMENT / AGENCY / OFFICE / COMPANY
                    <br />
                    (Write in full/Do not abbreviate)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    MONTHLY SALARY
                  </th>
                  <th rowSpan={2} className={thCls}>
                    SALARY/ JOB/ PAY GRADE (if applicable) &amp; STEP INCREMENT (Format &quot;00-0&quot;)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    STATUS OF APPOINTMENT
                  </th>
                  <th rowSpan={2} className={thCls}>
                    GOVT. SERVICE (Y/N)
                  </th>
                  {action}
                </tr>
                <tr>
                  <th className={thCls}>From</th>
                  <th className={thCls}>To</th>
                </tr>
              </>
            ),
          }}
          onAdd={(data) => addWorkExperience(employee.id, data)}
          onUpdate={(recordId, patch) => updateWorkExperience(employee.id, recordId, patch)}
          archive
          onDelete={(recordId) => archiveWorkExperience(employee.id, recordId)}
          readOnly={readOnly}
        />
        <SignatureRow />
      </Sheet>

      {/* ===================== PAGE 3 ===================== */}
      <Sheet page={3}>
        <SectionBar>VI. LEARNING AND DEVELOPMENT (L&amp;D) INTERVENTIONS/TRAINING PROGRAMS ATTENDED</SectionBar>
        <RecordManager
          items={employee.training}
          typeLabel="training record"
          addButtonLabel="Add Training"
          emptyMessage="No training records on file yet."
          employeeName={employee.displayName}
          itemLabel={(t) => t.course}
          fields={[
            { key: "course", label: "Course / training title", required: true },
            { key: "provider", label: "Provider" },
            { key: "fromDate", label: "From", type: "date" },
            { key: "completed", label: "To / Date completed", type: "date" },
            { key: "hours", label: "Number of hours" },
            { key: "ldType", label: "Type of L&D", hint: "Managerial, Supervisory, Technical, etc." },
            { key: "conductedBy", label: "Conducted / Sponsored by" },
            {
              key: "certStatus",
              label: "Certificate status",
              type: "select",
              options: [
                { value: "on-file", label: "On file" },
                { value: "expiring", label: "Expiring soon" },
              ],
            },
            {
              key: "expiresOn",
              label: "Expiry date",
              type: "date",
              required: true,
              showWhen: (f) => f.certStatus === "expiring",
              hint: "The exact date the certificate expires.",
            },
          ]}
          emptyForm={{
            course: "",
            provider: "",
            fromDate: "",
            completed: "",
            hours: "",
            ldType: "",
            conductedBy: "",
            certStatus: "on-file",
            expiresOn: "",
          }}
          columns={[
            { key: "course", label: "" },
            { key: "fromDate", label: "", render: (r) => fmtDMY(r.fromDate) },
            { key: "completed", label: "", render: (r) => fmtDMY(r.completed) },
            { key: "hours", label: "" },
            { key: "ldType", label: "" },
            { key: "conductedBy", label: "" },
          ]}
          formStyle={{
            widths: [34, 9, 9, 8, 12, 28],
            headRows: 2,
            minRows: 5,
            continueSheet: "C5",
            head: (action) => (
              <>
                <tr>
                  <th rowSpan={2} className={thCls}>
                    29. TITLE OF LEARNING AND DEVELOPMENT INTERVENTIONS/TRAINING PROGRAMS
                    <br />
                    (Write in full)
                  </th>
                  <th colSpan={2} className={thCls}>
                    INCLUSIVE DATES OF ATTENDANCE (dd/mm/yyyy)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    NUMBER OF HOURS
                  </th>
                  <th rowSpan={2} className={thCls}>
                    Type of L&amp;D (Managerial/ Supervisory/ Technical/etc)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    CONDUCTED/ SPONSORED BY
                    <br />
                    (Write in full)
                  </th>
                  {action}
                </tr>
                <tr>
                  <th className={thCls}>From</th>
                  <th className={thCls}>To</th>
                </tr>
              </>
            ),
          }}
          onAdd={(data) => addTraining(employee.id, data)}
          onUpdate={(recordId, patch) => updateTraining(employee.id, recordId, patch)}
          archive
          onDelete={canArchiveTraining ? (recordId) => archiveTraining(employee.id, recordId) : undefined}
          readOnly={readOnly}
        />
        <SectionBar>
          VII. VOLUNTARY WORK OR INVOLVEMENT IN CIVIC / NON-GOVERNMENT / PEOPLE / VOLUNTARY ORGANIZATION/S
        </SectionBar>
        <RecordManager
          items={employee.voluntaryWork}
          typeLabel="voluntary work record"
          addButtonLabel="Add Voluntary Work"
          emptyMessage="No voluntary work on file yet."
          employeeName={employee.displayName}
          itemLabel={(r) => r.organization}
          fields={[
            { key: "organization", label: "Name & address of organization", required: true },
            { key: "fromDate", label: "From", type: "date" },
            { key: "toDate", label: "To", type: "date" },
            { key: "hours", label: "Number of hours" },
            { key: "position", label: "Position / nature of work" },
          ]}
          emptyForm={{ organization: "", fromDate: "", toDate: "", hours: "", position: "" }}
          columns={[
            { key: "organization", label: "" },
            { key: "fromDate", label: "", render: (r) => fmtDMY(r.fromDate) },
            { key: "toDate", label: "", render: (r) => fmtDMY(r.toDate) },
            { key: "hours", label: "" },
            { key: "position", label: "" },
          ]}
          formStyle={{
            widths: [38, 10, 10, 9, 33],
            headRows: 2,
            minRows: 4,
            continueSheet: "C10",
            head: (action) => (
              <>
                <tr>
                  <th rowSpan={2} className={thCls}>
                    30. NAME &amp; ADDRESS OF ORGANIZATION
                    <br />
                    (Write in full)
                  </th>
                  <th colSpan={2} className={thCls}>
                    INCLUSIVE DATES (dd/mm/yyyy)
                  </th>
                  <th rowSpan={2} className={thCls}>
                    NUMBER OF HOURS
                  </th>
                  <th rowSpan={2} className={thCls}>
                    POSITION / NATURE OF WORK
                  </th>
                  {action}
                </tr>
                <tr>
                  <th className={thCls}>From</th>
                  <th className={thCls}>To</th>
                </tr>
              </>
            ),
          }}
          onAdd={(data) => addVoluntaryWork(employee.id, data)}
          onUpdate={(recordId, patch) => updateVoluntaryWork(employee.id, recordId, patch)}
          onDelete={(recordId) => deleteVoluntaryWork(employee.id, recordId)}
          readOnly={readOnly}
        />

        <SectionBar>VIII. OTHER INFORMATION</SectionBar>
        <div
          className={`grid grid-cols-[22%_46%_32%] ${LABEL_BG} border-b ${LINE} text-[10.5px] uppercase leading-tight`}
        >
          <div className={`border-r ${LINE} px-2 py-1.5`}>
            <span className="mr-2">31.</span>SPECIAL SKILLS and HOBBIES
          </div>
          <div className={`border-r ${LINE} px-2 py-1.5 text-center`}>
            <span className="float-left mr-2">32.</span>NON-ACADEMIC DISTINCTIONS / RECOGNITION
            <div className="normal-case">(Write in full)</div>
          </div>
          <div className="px-2 py-1.5 text-center">
            <span className="float-left mr-2">33.</span>MEMBERSHIP IN ASSOCIATION/ORGANIZATION
            <div className="normal-case">(Write in full)</div>
          </div>
        </div>
        <div className="grid grid-cols-[22%_46%_32%]">
          <div className={`flex border-r ${LINE}`}>
            <Txt
              multiline
              minH="min-h-[170px]"
              value={form.specialSkillsHobbies}
              onChange={(v) => set("specialSkillsHobbies", v)}
              disabled={d}
            />
          </div>
          <div className={`flex border-r ${LINE}`}>
            <Txt
              multiline
              minH="min-h-[170px]"
              value={form.nonAcademicDistinctions}
              onChange={(v) => set("nonAcademicDistinctions", v)}
              disabled={d}
            />
          </div>
          <div className="flex">
            <Txt
              multiline
              minH="min-h-[170px]"
              value={form.orgMemberships}
              onChange={(v) => set("orgMemberships", v)}
              disabled={d}
            />
          </div>
        </div>
        <ContinueNote sheet="C11" />
        <SignatureRow />
      </Sheet>

      {/* ===================== PAGE 4 ===================== */}
      <Sheet page={4}>
        <QRow n="34.">
          Are you related by consanguinity or affinity to the appointing or recommending authority, or to the chief of
          bureau or office or to the person who has immediate supervision over you in the Office, Bureau or Department
          where you will be appointed,
        </QRow>
        <QRow
          letter="a."
          answer={
            <YesNo value={form.q34RelatedThirdDegree} onChange={(v) => set("q34RelatedThirdDegree", v)} disabled={d} />
          }
        >
          within the third degree?
        </QRow>
        <QRow
          letter="b."
          answer={
            <>
              <YesNo
                value={form.q34RelatedFourthDegree}
                onChange={(v) => set("q34RelatedFourthDegree", v)}
                disabled={d}
              />
              <Detail
                label="If YES, give details:"
                value={form.q34Details}
                onChange={(v) => set("q34Details", v)}
                disabled={d || !(form.q34RelatedThirdDegree || form.q34RelatedFourthDegree)}
              />
            </>
          }
        >
          within the fourth degree (for Local Government Unit - Career Employees)?
        </QRow>

        <QRow
          n="35."
          letter="a."
          answer={
            <>
              <YesNo value={form.q35aAdminOffense} onChange={(v) => set("q35aAdminOffense", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q35aDetails}
                onChange={(v) => set("q35aDetails", v)}
                disabled={d || form.q35aAdminOffense !== true}
              />
            </>
          }
        >
          Have you ever been found guilty of any administrative offense?
        </QRow>
        <QRow
          letter="b."
          answer={
            <>
              <YesNo value={form.q35bCriminalCharge} onChange={(v) => set("q35bCriminalCharge", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q35bDetails}
                onChange={(v) => set("q35bDetails", v)}
                disabled={d || form.q35bCriminalCharge !== true}
              />
              <Detail
                label="Date Filed:"
                kind="date"
                value={form.q35bDateFiled}
                onChange={(v) => set("q35bDateFiled", v)}
                disabled={d || form.q35bCriminalCharge !== true}
              />
              <Detail
                label="Status of Case/s:"
                value={form.q35bStatus}
                onChange={(v) => set("q35bStatus", v)}
                disabled={d || form.q35bCriminalCharge !== true}
              />
            </>
          }
        >
          Have you been criminally charged before any court?
        </QRow>

        <QRow
          n="36."
          answer={
            <>
              <YesNo value={form.q36Convicted} onChange={(v) => set("q36Convicted", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q36Details}
                onChange={(v) => set("q36Details", v)}
                disabled={d || form.q36Convicted !== true}
              />
            </>
          }
        >
          Have you ever been convicted of any crime or violation of any law, decree, ordinance or regulation by any
          court or tribunal?
        </QRow>

        <QRow
          n="37."
          answer={
            <>
              <YesNo value={form.q37Separated} onChange={(v) => set("q37Separated", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q37Details}
                onChange={(v) => set("q37Details", v)}
                disabled={d || form.q37Separated !== true}
              />
            </>
          }
        >
          Have you ever been separated from the service in any of the following modes: resignation, retirement, dropped
          from the rolls, dismissal, termination, end of term, finished contract or phased out (abolition) in the public
          or private sector?
        </QRow>

        <QRow
          n="38."
          letter="a."
          answer={
            <>
              <YesNo value={form.q38aCandidate} onChange={(v) => set("q38aCandidate", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q38aDetails}
                onChange={(v) => set("q38aDetails", v)}
                disabled={d || form.q38aCandidate !== true}
              />
            </>
          }
        >
          Have you ever been a candidate in a national or local election held within the last year (except Barangay
          election)?
        </QRow>
        <QRow
          letter="b."
          answer={
            <>
              <YesNo value={form.q38bResigned} onChange={(v) => set("q38bResigned", v)} disabled={d} />
              <Detail
                label="If YES, give details:"
                value={form.q38bDetails}
                onChange={(v) => set("q38bDetails", v)}
                disabled={d || form.q38bResigned !== true}
              />
            </>
          }
        >
          Have you resigned from the government service during the three (3)-month period before the last election to
          promote/actively campaign for a national or local candidate?
        </QRow>

        <QRow
          n="39."
          answer={
            <>
              <YesNo value={form.q39Immigrant} onChange={(v) => set("q39Immigrant", v)} disabled={d} />
              <Detail
                label="If YES, give details (country):"
                value={form.q39Country}
                onChange={(v) => set("q39Country", v)}
                disabled={d || form.q39Immigrant !== true}
              />
            </>
          }
        >
          Have you acquired the status of an immigrant or permanent resident of another country?
        </QRow>

        <QRow n="40.">
          Pursuant to: (a) Indigenous People&apos;s Act (RA 8371); (b) Magna Carta for Disabled Persons (RA 7277, as
          amended); and (c) Expanded Solo Parents Welfare Act (RA 11861), please answer the following items:
        </QRow>
        <QRow
          letter="a."
          answer={
            <>
              <YesNo value={form.q40aIndigenous} onChange={(v) => set("q40aIndigenous", v)} disabled={d} />
              <Detail
                label="If YES, please specify:"
                value={form.q40aDetails}
                onChange={(v) => set("q40aDetails", v)}
                disabled={d || form.q40aIndigenous !== true}
              />
            </>
          }
        >
          Are you a member of any indigenous group?
        </QRow>
        <QRow
          letter="b."
          answer={
            <>
              <YesNo value={form.q40bPwd} onChange={(v) => set("q40bPwd", v)} disabled={d} />
              <Detail
                label="If YES, please specify ID No:"
                value={form.q40bIdNo}
                onChange={(v) => set("q40bIdNo", v)}
                disabled={d || form.q40bPwd !== true}
              />
            </>
          }
        >
          Are you a person with disability?
        </QRow>
        <QRow
          letter="c."
          answer={
            <>
              <YesNo value={form.q40cSoloParent} onChange={(v) => set("q40cSoloParent", v)} disabled={d} />
              <Detail
                label="If YES, please specify ID No:"
                value={form.q40cIdNo}
                onChange={(v) => set("q40cIdNo", v)}
                disabled={d || form.q40cSoloParent !== true}
              />
            </>
          }
        >
          Are you a solo parent?
        </QRow>

        <div className="grid grid-cols-[1fr_190px]">
          <div className={`min-w-0 border-r ${LINE}`}>
            <div className={`border-b ${LINE} px-2 py-1 text-[11px]`}>
              <span className="mr-2">41.</span>REFERENCES{" "}
              <strong>(Person not related by consanguinity or affinity to applicant /appointee)</strong>
            </div>
            <RecordManager
              items={employee.pdsReferences}
              typeLabel="reference"
              addButtonLabel="Add Reference"
              emptyMessage="No references on file yet."
              employeeName={employee.displayName}
              itemLabel={(r) => r.name}
              fields={[
                { key: "name", label: "Name", required: true },
                { key: "address", label: "Office / Residential Address" },
                { key: "contact", label: "Contact No. and/or Email" },
              ]}
              emptyForm={{ name: "", address: "", contact: "" }}
              columns={[
                { key: "name", label: "" },
                { key: "address", label: "" },
                { key: "contact", label: "" },
              ]}
              formStyle={{
                widths: [34, 40, 26],
                headRows: 1,
                minRows: 3,
                head: (action) => (
                  <>
                    <tr>
                      <th className={thCls}>NAME</th>
                      <th className={thCls}>OFFICE / RESIDENTIAL ADDRESS</th>
                      <th className={thCls}>CONTACT NO. AND/OR EMAIL</th>
                      {action}
                    </tr>
                  </>
                ),
              }}
              onAdd={(data) => addPdsReference(employee.id, data)}
              onUpdate={(recordId, patch) => updatePdsReference(employee.id, recordId, patch)}
              onDelete={(recordId) => deletePdsReference(employee.id, recordId)}
              readOnly={readOnly}
            />

            <div className={`border-y ${LINE} ${LABEL_BG} px-2 py-2 text-[12px] leading-snug`}>
              <span className="mr-2 text-[11px]">42.</span>I declare under oath that I have personally accomplished this
              Personal Data Sheet which is a true, correct, and complete statement pursuant to the provisions of
              pertinent laws, rules, and regulations of the Republic of the Philippines. I authorize the agency
              head/authorized representative to verify/validate the contents stated herein. I agree that any
              misrepresentation made in this document and its attachments shall cause the filing of
              administrative/criminal case/s against me.
            </div>

            <div className="grid grid-cols-[42%_58%]">
              <div className={`border-r ${LINE} text-[11px]`}>
                <div className={`border-b ${LINE} px-1.5 py-1 leading-tight`}>
                  Government Issued ID (i.e.Passport, GSIS, SSS, PRC, Driver&apos;s License, etc.){" "}
                  <em className="underline">PLEASE INDICATE ID Number and Date of Issuance</em>
                </div>
                <div className={`flex border-b ${LINE}`}>
                  <div className={`w-[46%] shrink-0 border-r ${LINE} px-1.5 py-1.5`}>Government Issued ID:</div>
                  <Txt value={form.govIdType} onChange={(v) => set("govIdType", v)} disabled={d} />
                </div>
                <div className={`flex border-b ${LINE}`}>
                  <div className={`w-[46%] shrink-0 border-r ${LINE} px-1.5 py-1.5`}>ID/License/Passport No.:</div>
                  <Txt value={form.govIdNumber} onChange={(v) => set("govIdNumber", v)} disabled={d} />
                </div>
                <div className="flex">
                  <div className={`w-[46%] shrink-0 border-r ${LINE} px-1.5 py-1.5`}>Date/Place of Issuance:</div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Txt
                      kind="date"
                      value={form.govIdDateIssued}
                      onChange={(v) => set("govIdDateIssued", v)}
                      disabled={d}
                    />
                    <div className={`flex border-t ${LINE}`}>
                      <Txt
                        value={form.govIdPlaceIssued}
                        onChange={(v) => set("govIdPlaceIssued", v)}
                        disabled={d}
                        placeholder="Place"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex flex-1 items-center justify-center px-2 text-center text-[10.5px] font-bold text-red-600">
                  (e-signature/digital certificate)
                </div>
                <div className={`border-t ${LINE} ${LABEL_BG} py-0.5 text-center text-[11px]`}>
                  Signature (Sign inside the box)
                </div>
                <div className={`border-t ${LINE} ${LABEL_BG} py-0.5 text-center text-[11px]`}>Date Accomplished</div>
              </div>
            </div>
          </div>

          {/* photo + right thumbmark */}
          <div className="flex flex-col gap-3 p-2">
            <div
              className={`flex h-[178px] flex-col items-center justify-center overflow-hidden border ${LINE} p-1 text-center text-[10px] leading-snug`}
            >
              {employee.photoUrl ? (
                <SkeletonImage
                  src={employee.photoUrl}
                  alt={`Photo of ${employee.displayName}`}
                  wrapperClassName="h-full w-full"
                  className="h-full w-full object-cover"
                  skeletonRounded="rounded-none"
                />
              ) : (
                <>
                  Passport-sized unfiltered digital picture taken within the last 6 months
                  <br />
                  4.5 cm. X 3.5 cm
                  <div className="mt-6 text-neutral-500">PHOTO</div>
                </>
              )}
            </div>
            <div className={`flex flex-1 flex-col justify-end border ${LINE}`}>
              <div className={`border-t ${LINE} ${LABEL_BG} py-0.5 text-center text-[11px]`}>Right Thumbmark</div>
            </div>
          </div>
        </div>

        <div className={`border-t-2 border-neutral-800 px-4 py-3 text-center text-[11.5px]`}>
          SUBSCRIBED AND SWORN to before me this ______________________, affiant exhibiting his/her validly issued
          government ID as indicated above.
          <div className={`mx-auto mt-4 w-[52%] border ${LINE}`}>
            <div className="flex h-16 items-center justify-center text-[10px] font-bold text-red-600">
              (e-signature/digital certificate except for notary public)
            </div>
            <div className={`border-t ${LINE} ${LABEL_BG} py-0.5 text-[12px]`}>Person Administering Oath</div>
          </div>
        </div>
      </Sheet>

      {!readOnly && editing && needsCertification && (
        <label className="flex items-start gap-3 rounded-xl border border-border bg-white p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={certified}
            onChange={(e) => setCertified(e.target.checked)}
            className="mt-1 w-4 h-4 flex-shrink-0"
          />
          <span className="text-[0.88rem] leading-snug">
            <strong>I hereby certify</strong> that the information I have provided in this Personal Data Sheet is true,
            correct and complete to the best of my knowledge and belief, and I understand that any false statement may
            be grounds for administrative action.
          </span>
        </label>
      )}

      {!readOnly && editing && (
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={saving}>
            <X size={16} />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || (needsCertification && !certified)}>
            {saving ? "Saving…" : "Save PDS Details"}
          </Button>
        </div>
      )}
    </div>
  );
}
