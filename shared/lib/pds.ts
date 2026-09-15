// Generates a printable Personal Data Sheet that follows the layout of CS
// Form No. 212 (Revised 2025), populated from the employee's 201 file
// records (including their extended PDS Details). Opens a new tab with a
// print-ready HTML document — the browser's own "Save as PDF" / print
// dialog handles export, so no extra PDF dependency is needed.

import { emptyPdsDetails } from "@/shared/types";
import type { Employee, PdsDetails } from "@/shared/types";
import { printHtmlDocument } from "./printDocument";

function esc(value: string | number | null | undefined): string {
  const str = value === null || value === undefined || value === "" ? "" : String(value);
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Best-effort split of "First Middle Last" into PDS-style name fields. */
function splitName(fullName: string): { first: string; middle: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: fullName, middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return { first: parts[0], middle: parts.slice(1, -1).join(" "), last: parts[parts.length - 1] };
}

function box(value: string | number | null | undefined): string {
  return `<div class="box">${esc(value) || "&nbsp;"}</div>`;
}

function field(label: string, value: string | number | null | undefined, flex = 1): string {
  return `<div class="f" style="flex:${flex}"><span class="lbl">${esc(label)}</span>${box(value)}</div>`;
}

function checkbox(label: string, checked: boolean | null | undefined): string {
  return `<span class="chk">${checked ? "☑" : "☐"} ${esc(label)}</span>`;
}

function addrLine(a: {
  houseBlockLot: string | null;
  street: string | null;
  subdivision: string | null;
  barangay: string | null;
  cityMunicipality: string | null;
  province: string | null;
  zipCode: string | null;
}): string {
  const parts = [
    a.houseBlockLot,
    a.street,
    a.subdivision,
    a.barangay,
    a.cityMunicipality,
    a.province,
    a.zipCode,
  ].filter((p) => p && p.trim());
  return parts.length ? esc(parts.join(", ")) : "";
}

function yesNoLine(
  label: string,
  value: boolean | null,
  details: string | null | undefined,
  extra?: { label: string; value: string | null | undefined }[],
): string {
  const detailBits: string[] = [];
  if (value && details) detailBits.push(esc(details));
  if (value && extra) {
    for (const e of extra) if (e.value) detailBits.push(`${esc(e.label)}: ${esc(e.value)}`);
  }
  return `<div class="decl-row">
    <p class="decl-q">${esc(label)}</p>
    <div class="decl-ans">${checkbox("Yes", value === true)} &nbsp; ${checkbox("No", value === false || value === null)}</div>
    ${value && detailBits.length ? `<p class="decl-details">${detailBits.join(" — ")}</p>` : ""}
  </div>`;
}

function buildEducationRows(employee: Employee): string {
  const order = ["Elementary", "Secondary", "Vocational / Trade", "College", "Graduate Studies"];
  const byLevel = new Map(employee.education.map((e) => [e.level || "", e]));
  const rows = order.map((level) => {
    const e = byLevel.get(level);
    return `<tr>
      <td class="lvl">${esc(level.toUpperCase())}</td>
      <td>${e ? esc(e.schoolName) : ""}</td>
      <td>${e ? esc(e.degree) : ""}</td>
      <td>${e ? esc(e.yearGraduated) : ""}</td>
      <td>${e ? esc(e.honors) : ""}</td>
    </tr>`;
  });
  const extras = employee.education.filter((e) => !order.includes(e.level || ""));
  for (const e of extras) {
    rows.push(
      `<tr><td class="lvl">${esc((e.level || "").toUpperCase())}</td><td>${esc(e.schoolName)}</td><td>${esc(e.degree)}</td><td>${esc(e.yearGraduated)}</td><td>${esc(e.honors)}</td></tr>`,
    );
  }
  return rows.join("");
}

function buildEligibilityRows(employee: Employee): string {
  if (employee.civilServiceEligibility.length === 0) {
    return `<tr><td colspan="5" class="empty">No civil service eligibility on file.</td></tr>`;
  }
  return employee.civilServiceEligibility
    .map(
      (r) => `<tr>
      <td>${esc(r.name)}</td>
      <td>${esc(r.rating)}</td>
      <td>${esc(r.examDate)}</td>
      <td>${esc(r.examPlace)}</td>
      <td>${esc(r.licenseNumber)}${r.licenseValidUntil ? ` (valid until ${esc(r.licenseValidUntil)})` : ""}</td>
    </tr>`,
    )
    .join("");
}

function buildWorkExperienceRows(employee: Employee): string {
  if (employee.workExperience.length === 0) {
    return `<tr><td colspan="6" class="empty">No prior work experience on file.</td></tr>`;
  }
  return employee.workExperience
    .map(
      (w) => `<tr>
      <td>${esc(w.fromDate)} – ${esc(w.toDate || "Present")}</td>
      <td>${esc(w.position)}</td>
      <td>${esc(w.company)}</td>
      <td>${esc(w.statusOfAppointment)}</td>
      <td class="ctr">${w.govtService === "Y" ? "Y" : w.govtService === "N" ? "N" : ""}</td>
      <td>${esc(w.description)}</td>
    </tr>`,
    )
    .join("");
}

function buildVoluntaryWorkRows(employee: Employee): string {
  if (employee.voluntaryWork.length === 0) {
    return `<tr><td colspan="4" class="empty">No voluntary work on file.</td></tr>`;
  }
  return employee.voluntaryWork
    .map(
      (v) => `<tr>
      <td>${esc(v.organization)}</td>
      <td>${esc(v.fromDate)} – ${esc(v.toDate || "Present")}</td>
      <td class="ctr">${esc(v.hours)}</td>
      <td>${esc(v.position)}</td>
    </tr>`,
    )
    .join("");
}

function buildTrainingRows(employee: Employee): string {
  if (employee.training.length === 0) {
    return `<tr><td colspan="5" class="empty">No learning &amp; development records on file.</td></tr>`;
  }
  return employee.training
    .map(
      (t) => `<tr>
      <td>${esc(t.course)}</td>
      <td>${esc(t.fromDate)} – ${esc(t.completed)}</td>
      <td class="ctr">${esc(t.hours)}</td>
      <td>${esc(t.ldType)}</td>
      <td>${esc(t.conductedBy || t.provider)}</td>
    </tr>`,
    )
    .join("");
}

function buildReferenceRows(employee: Employee): string {
  if (employee.pdsReferences.length === 0) {
    return `<tr><td colspan="3" class="empty">No references on file.</td></tr>`;
  }
  return employee.pdsReferences
    .map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.address)}</td><td>${esc(r.contact)}</td></tr>`)
    .join("");
}

function buildChildrenBlock(employee: Employee): string {
  const p = employee.pds;
  if (p.children.length === 0) return '<span class="muted">None on file</span>';
  return p.children.map((c) => `${esc(c.name)}${c.dob ? ` (b. ${esc(c.dob)})` : ""}`).join("; ");
}

function buildHtml(employee: Employee): string {
  const { first, middle, last } = splitName(employee.fullName);
  const p = employee.pds;
  const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const cs = (employee.civilStatus || "").trim();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Personal Data Sheet — ${esc(employee.displayName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; padding: 0; font-size: 10.5px; }
  .page { padding: 22px 28px; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .title { text-align: center; font-weight: 700; font-size: 1.05rem; letter-spacing: 0.04em; margin: 0 0 4px; text-transform: uppercase; }
  .warning { font-size: 8.5px; text-align: center; color: #444; margin: 0 0 10px; line-height: 1.4; }
  .section-h {
    background: #1f2a44; color: #fff; font-weight: 700; font-size: 9.5px; letter-spacing: 0.04em;
    padding: 4px 8px; margin: 12px 0 6px; text-transform: uppercase;
  }
  .row { display: flex; gap: 8px; margin-bottom: 4px; }
  .f { display: flex; flex-direction: column; }
  .lbl { font-size: 7.5px; color: #555; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 1px; }
  .box { border: 1px solid #888; border-radius: 2px; padding: 3px 5px; min-height: 16px; font-size: 9.5px; font-weight: 600; background: #fff; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 6px; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f1f4; font-size: 8px; text-transform: uppercase; letter-spacing: 0.02em; }
  td.lvl { font-weight: 700; white-space: nowrap; }
  td.ctr { text-align: center; }
  td.empty { color: #999; font-style: italic; text-align: center; }
  .chk { margin-right: 12px; font-size: 9.5px; }
  .decl-row { margin-bottom: 6px; display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; border-bottom: 1px dotted #ccc; padding-bottom: 4px; }
  .decl-q { flex: 1 1 55%; margin: 0; font-size: 9px; }
  .decl-ans { flex: 0 0 auto; white-space: nowrap; }
  .decl-details { flex-basis: 100%; margin: 0; font-size: 8.5px; color: #444; font-style: italic; }
  .muted { color: #999; font-style: italic; }
  .sig-row { display: flex; justify-content: space-between; margin-top: 30px; }
  .sig-box { width: 46%; text-align: center; }
  .sig-line { border-top: 1px solid #333; padding-top: 3px; font-size: 9px; }
  .page-footer { margin-top: 16px; font-size: 8px; color: #888; text-align: center; }
  @media print { .page { padding: 14px 20px; } }
</style>
</head>
<body>

<div class="page">
  <p class="title">Personal Data Sheet</p>
  <p class="warning">WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the filing of administrative/criminal case/s against the person concerned.<br/>Print legibly. Indicate N/A if not applicable. Generated from 201 File records on file.</p>

  <div class="section-h">I. Personal Information</div>
  <div class="row">
    ${field("1. Surname", last, 2)}
    ${field("2. First Name", first, 2)}
    ${field("Middle Name", middle, 2)}
    ${field("Name Extension", p.nameExtension, 1)}
  </div>
  <div class="row">
    ${field("3. Date of Birth", employee.dob, 1)}
    ${field("4. Place of Birth", p.placeOfBirth, 1)}
    ${field("5. Sex at Birth", p.sexAtBirth, 1)}
    ${field("6. Civil Status", cs, 1)}
  </div>
  <div class="row">
    ${field("7. Height (m)", p.heightM, 1)}
    ${field("8. Weight (kg)", p.weightKg, 1)}
    ${field("9. Blood Type", p.bloodType, 1)}
    ${field("16. Citizenship", employee.nationality, 1)}
    ${field("Dual Citizenship Country", p.dualCitizenshipCountry, 1)}
  </div>
  <div class="row">
    ${field("10. GSIS/UMID ID No.", p.gsisUmidNo, 1)}
    ${field("11. Pag-IBIG ID No.", p.pagibigNo, 1)}
    ${field("12. PhilHealth No.", p.philhealthNo, 1)}
    ${field("13. PhilSys Number", p.philsysNumber, 1)}
  </div>
  <div class="row">
    ${field("14. TIN No.", p.tinNo, 1)}
    ${field("15. Agency Employee No.", p.agencyEmployeeNo, 1)}
    ${field("19. Telephone No.", p.telephoneNo, 1)}
    ${field("20. Mobile No.", p.mobileNo, 1)}
    ${field("21. Email Address", employee.email, 2)}
  </div>
  <div class="row">
    ${field("17. Residential Address", addrLine(p.residentialAddress), 1)}
  </div>
  <div class="row">
    ${field("18. Permanent Address", p.permanentSameAsResidential ? "Same as residential address" : addrLine(p.permanentAddress), 1)}
  </div>

  <div class="section-h">II. Family Background</div>
  <div class="row">
    ${field("22. Spouse's Surname", p.spouseSurname, 1)}
    ${field("First Name", p.spouseFirstName, 1)}
    ${field("Middle Name", p.spouseMiddleName, 1)}
    ${field("Name Extension", p.spouseNameExtension, 1)}
  </div>
  <div class="row">
    ${field("Occupation", p.spouseOccupation, 1)}
    ${field("Employer/Business Name", p.spouseEmployer, 1)}
    ${field("Business Address", p.spouseBusinessAddress, 1)}
    ${field("Telephone No.", p.spouseTelephone, 1)}
  </div>
  <div class="row">
    ${field("23. Name of Children (Date of Birth)", buildChildrenBlock(employee), 1)}
  </div>
  <div class="row">
    ${field("24. Father's Surname", p.fatherSurname, 1)}
    ${field("First Name", p.fatherFirstName, 1)}
    ${field("Middle Name", p.fatherMiddleName, 1)}
    ${field("Name Extension", p.fatherNameExtension, 1)}
  </div>
  <div class="row">
    ${field("25. Mother's Maiden Surname", p.motherMaidenSurname, 1)}
    ${field("First Name", p.motherFirstName, 1)}
    ${field("Middle Name", p.motherMiddleName, 1)}
  </div>

  <div class="section-h">III. Educational Background</div>
  <table>
    <thead><tr><th>26. Level</th><th>Name of School</th><th>Degree / Course</th><th>Year Graduated</th><th>Scholarship / Honors</th></tr></thead>
    <tbody>${buildEducationRows(employee)}</tbody>
  </table>

  <p class="page-footer">CS Form 212 (Revised 2025) — Page 1 of 4 &nbsp;·&nbsp; Employee #${esc(employee.employeeNumber)} — ${esc(employee.displayName)} &nbsp;·&nbsp; Generated ${esc(generatedOn)}</p>
</div>

<div class="page">
  <div class="section-h">IV. Civil Service Eligibility</div>
  <table>
    <thead><tr><th>27. Eligibility</th><th>Rating</th><th>Date of Exam / Conferment</th><th>Place of Exam / Conferment</th><th>License Number / Validity</th></tr></thead>
    <tbody>${buildEligibilityRows(employee)}</tbody>
  </table>

  <div class="section-h">V. Work Experience</div>
  <p style="font-size:8.5px;color:#666;margin:0 0 6px;">(Include this Present Position. Gov't Service column indicates whether the position was in government.)</p>
  <table>
    <thead><tr><th>Inclusive Dates</th><th>Position Title</th><th>Company / Agency</th><th>Status of Appointment</th><th>Gov't Service</th><th>Description</th></tr></thead>
    <tbody>${buildWorkExperienceRows(employee)}</tbody>
  </table>

  <p class="page-footer">CS Form 212 (Revised 2025) — Page 2 of 4 &nbsp;·&nbsp; Employee #${esc(employee.employeeNumber)} — ${esc(employee.displayName)}</p>
</div>

<div class="page">
  <div class="section-h">VI. Voluntary Work or Involvement</div>
  <table>
    <thead><tr><th>Name & Address of Organization</th><th>Inclusive Dates</th><th>Number of Hours</th><th>Position / Nature of Work</th></tr></thead>
    <tbody>${buildVoluntaryWorkRows(employee)}</tbody>
  </table>

  <div class="section-h">VII. Learning and Development (L&amp;D) Interventions / Training Programs Attended</div>
  <table>
    <thead><tr><th>Title</th><th>Inclusive Dates</th><th>Hours</th><th>Type of L&amp;D</th><th>Conducted / Sponsored By</th></tr></thead>
    <tbody>${buildTrainingRows(employee)}</tbody>
  </table>

  <p class="page-footer">CS Form 212 (Revised 2025) — Page 3 of 4 &nbsp;·&nbsp; Employee #${esc(employee.employeeNumber)} — ${esc(employee.displayName)}</p>
</div>

<div class="page">
  <div class="section-h">VIII. Other Information</div>
  <div class="row">
    ${field("33a. Special Skills and Hobbies", p.specialSkillsHobbies, 1)}
  </div>
  <div class="row">
    ${field("33b. Non-Academic Distinctions / Recognition", p.nonAcademicDistinctions, 1)}
  </div>
  <div class="row">
    ${field("33c. Membership in Association / Organization", p.orgMemberships, 1)}
  </div>

  <div class="section-h">Declarations</div>
  ${yesNoLine("34a. Related within the third degree of consanguinity/affinity to the appointing or recommending authority?", p.q34RelatedThirdDegree, p.q34Details)}
  ${yesNoLine("34b. Related within the fourth degree of consanguinity/affinity to the appointing officer (LGU)?", p.q34RelatedFourthDegree, p.q34Details)}
  ${yesNoLine("35a. Ever been found guilty of any administrative offense?", p.q35aAdminOffense, p.q35aDetails)}
  ${yesNoLine("35b. Criminally charged before any court?", p.q35bCriminalCharge, p.q35bDetails, [
    { label: "Date Filed", value: p.q35bDateFiled },
    { label: "Status", value: p.q35bStatus },
  ])}
  ${yesNoLine("36. Convicted of any crime or violation of law, decree, ordinance or regulation?", p.q36Convicted, p.q36Details)}
  ${yesNoLine("37. Separated from the service (resignation, retirement, dismissal, dropped, etc.)?", p.q37Separated, p.q37Details)}
  ${yesNoLine("38a. Ever been a candidate in a national or local election (except barangay election)?", p.q38aCandidate, p.q38aDetails)}
  ${yesNoLine("38b. Resigned from government service to campaign for a candidate/political party?", p.q38bResigned, p.q38bDetails)}
  ${yesNoLine("39. Acquired the status of an immigrant or permanent resident of another country?", p.q39Immigrant, null, [{ label: "Country", value: p.q39Country }])}
  ${yesNoLine("40a. Member of any indigenous group?", p.q40aIndigenous, p.q40aDetails)}
  ${yesNoLine("40b. Person with disability?", p.q40bPwd, null, [{ label: "ID No.", value: p.q40bIdNo }])}
  ${yesNoLine("40c. Solo parent?", p.q40cSoloParent, null, [{ label: "ID No.", value: p.q40cIdNo }])}

  <div class="section-h">41. References</div>
  <table>
    <thead><tr><th>Name</th><th>Address</th><th>Contact No.</th></tr></thead>
    <tbody>${buildReferenceRows(employee)}</tbody>
  </table>

  <div class="row">
    ${field("Government Issued ID", p.govIdType, 1)}
    ${field("ID / License / Passport No.", p.govIdNumber, 1)}
    ${field("Date of Issuance", p.govIdDateIssued, 1)}
    ${field("Place of Issuance", p.govIdPlaceIssued, 1)}
  </div>

  <p style="font-size:9px; margin-top:18px;">I certify that the above information is true and correct to the best of my knowledge and belief.</p>
  <div class="sig-row">
    <div class="sig-box"><div class="sig-line">${esc(employee.fullName)}<br/>Signature over Printed Name</div></div>
    <div class="sig-box"><div class="sig-line">Date</div></div>
  </div>

  <p class="page-footer">CS Form 212 (Revised 2025) — Page 4 of 4 &nbsp;·&nbsp; Employee #${esc(employee.employeeNumber)} — ${esc(employee.displayName)} &nbsp;·&nbsp; Generated ${esc(generatedOn)}</p>
</div>

</body>
</html>`;
}

/**
 * Builds a print-ready Personal Data Sheet, laid out to follow CS Form
 * No. 212 (Revised 2025), from the employee's existing 201 file records
 * (including PDS Details), and triggers the browser print dialog, letting
 * the user save it as a PDF. Prints via a hidden iframe rather than a new
 * tab so it can't be silently blocked by the browser's popup blocker.
 */
export function exportPds(employee: Employee): void {
  const html = buildHtml(employee);
  printHtmlDocument(html);
}

/**
 * Parses the text content of a previously-imported PDS JSON file and pulls
 * out only the fields that belong to `PdsDetails`, ignoring anything else in
 * the file. Accepts either a bare PdsDetails object or an object with a
 * `pds` key (e.g. a full employee record), so a file exported from another
 * 201 file can be reused. Throws if the text isn't valid JSON.
 */
export function parsePdsImportText(text: string): Partial<PdsDetails> {
  const raw = JSON.parse(text);
  const source = raw && typeof raw === "object" && raw.pds && typeof raw.pds === "object" ? raw.pds : raw;
  const template = emptyPdsDetails();
  const result: Partial<PdsDetails> = {};
  if (!source || typeof source !== "object") return result;
  for (const key of Object.keys(template) as (keyof PdsDetails)[]) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      (result as Record<string, unknown>)[key] = (source as Record<string, unknown>)[key];
    }
  }
  return result;
}
