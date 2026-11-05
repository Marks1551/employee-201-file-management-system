// Exports an employee's Personal Data Sheet as the official CS Form No. 212
// (Revised 2026) Excel file.
//
// The export fills in a copy of the real template (public/templates/…xlsx), so the
// result has exactly the template's layout, merged cells, checkboxes, dropdown,
// print areas and continuation sheets (C5–C11). Only the value cells are changed.
// Nothing here re-creates the form's look, which is why it can't drift from it.
//
// Where the data runs past a page's rows (e.g. more training records than fit on
// page 3) the extra rows continue onto the matching continuation sheet, as the
// form itself instructs.

import JSZip from "jszip";
import type { Employee, PdsAddress } from "@/shared/types";
import { toInputDate } from "@/shared/lib/dateFormat";
import { getNameParts } from "@/shared/lib/names";
import { pdsCountryIndex } from "@/shared/lib/pdsCountries";
import { SheetEditor } from "@/shared/lib/xlsxSheetEditor";
import { downloadWorkbookBuffer } from "@/shared/lib/xlsxTheme";

export const PDS_TEMPLATE_URL = "/templates/CS_Form_212_Revised_2026_PDS.xlsx";

/** Worksheet part for each template sheet (the template is bundled, so this is fixed). */
const SHEET_PART = {
  C1: 1,
  C2: 2,
  C3: 3,
  C4: 4,
  C5: 5, // L&D continuation
  C6: 6, // Work experience continuation
  C7: 7, // Family background continuation (children)
  C8: 8, // Education continuation
  C9: 9, // Eligibility continuation
  C10: 10, // Voluntary work continuation
  C11: 11, // Other information continuation
} as const;
type SheetKey = keyof typeof SHEET_PART;

/** Don't add directory entries (e.g. "xl/media/") to the zip — Excel doesn't need them. */
const NO_FOLDERS = { createFolders: false } as const;

/** zip.file() without JSZip adding directory entries. */
function put(zip: JSZip, path: string, data: string | Uint8Array): void {
  zip.file(path, data, NO_FOLDERS);
}

export interface PdsPhoto {
  bytes: Uint8Array;
  extension: "png" | "jpeg";
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

const s = (v: string | number | null | undefined): string => (v === null || v === undefined ? "" : String(v).trim());

/** Stored dates ("March 11, 2025", "2025-03-11", "11/03/2025") -> the form's dd/mm/yyyy. */
export function toDMY(value: string | null | undefined): string {
  const raw = s(value);
  if (!raw) return "";
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
  const iso = toInputDate(raw);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw; // "2019", "Present", free text — leave as typed
  // A bare "March 2022" is stored as the 1st; keep month precision honest by showing it as typed.
  if (/^[A-Za-z]+\s+\d{4}$/.test(raw)) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function splitLines(text: string | null | undefined): string[] {
  return s(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Splits text over two form lines at a word boundary near `max` characters. */
function splitForLines(text: string, max: number): [string, string] {
  if (text.length <= max) return [text, ""];
  const cut = text.lastIndexOf(" ", max);
  const at = cut > max / 2 ? cut : max;
  return [text.slice(0, at).trim(), text.slice(at).trim()];
}

function levelRow(level: string | null): number | null {
  const l = s(level).toLowerCase();
  if (l.startsWith("elementary")) return 55;
  if (l.startsWith("secondary")) return 56;
  if (l.startsWith("vocational")) return 57;
  if (l.startsWith("college")) return 58;
  if (l.startsWith("graduate")) return 59;
  return null;
}

type CellMap = Record<string, string>;

/** Writes records into consecutive rows; returns the records that didn't fit. */
function fillRows<T>(
  ed: SheetEditor,
  records: T[],
  firstRow: number,
  rowCount: number,
  toCells: (rec: T) => CellMap,
): T[] {
  records.slice(0, rowCount).forEach((rec, i) => {
    for (const [col, value] of Object.entries(toCells(rec))) {
      if (value) ed.set(`${col}${firstRow + i}`, value);
    }
  });
  return records.slice(rowCount);
}

// ---------------------------------------------------------------------------
// Form controls (checkboxes / dropdown) — kept in sync with their linked cells
// ---------------------------------------------------------------------------

async function syncControls(
  zip: JSZip,
  sheetPart: number,
  checks: Map<string, boolean>,
  dropdown?: { link: string; index: number },
): Promise<void> {
  const relsPath = `xl/worksheets/_rels/sheet${sheetPart}.xml.rels`;
  const rels = await zip.file(relsPath)?.async("string");
  if (!rels) return;

  for (const m of rels.matchAll(/Target="\.\.\/ctrlProps\/(ctrlProp\d+\.xml)"/g)) {
    const path = `xl/ctrlProps/${m[1]}`;
    let xml = await zip.file(path)!.async("string");
    const link = /fmlaLink="([^"]*)"/.exec(xml)?.[1]?.replace(/\$/g, "");
    if (!link) continue;
    if (/objectType="CheckBox"/.test(xml) && checks.has(link)) {
      xml = xml.replace(/\schecked="[^"]*"/, "");
      if (checks.get(link)) xml = xml.replace(/objectType="CheckBox"/, 'objectType="CheckBox" checked="Checked"');
      put(zip, path, xml);
    } else if (dropdown && /objectType="Drop"/.test(xml) && link === dropdown.link) {
      xml = xml.replace(/\ssel="\d+"/, ` sel="${dropdown.index}"`);
      put(zip, path, xml);
    }
  }

  // The legacy VML copy of each control (used by older Excel versions) carries the same state.
  const vmlTarget = /Target="\.\.\/drawings\/(vmlDrawing\d+\.vml)"/.exec(rels)?.[1];
  if (!vmlTarget) return;
  const vmlPath = `xl/drawings/${vmlTarget}`;
  let vml = await zip.file(vmlPath)!.async("string");
  vml = vml.replace(/<v:shape\b[\s\S]*?<\/v:shape>/g, (shape) => {
    const link = /<x:FmlaLink>\s*([^<]*?)\s*<\/x:FmlaLink>/.exec(shape)?.[1]?.replace(/\$/g, "");
    if (!link) return shape;
    if (/<x:ClientData ObjectType="Checkbox"/i.test(shape) && checks.has(link)) {
      let out = shape.replace(/<x:Checked>\d*<\/x:Checked>/, "");
      if (checks.get(link)) out = out.replace(/(<\/x:FmlaLink>)/, "$1<x:Checked>1</x:Checked>");
      return out;
    }
    if (dropdown && /<x:ClientData ObjectType="Drop"/i.test(shape) && link === dropdown.link) {
      return shape.replace(/<x:Sel>\d*<\/x:Sel>/, `<x:Sel>${dropdown.index}</x:Sel>`);
    }
    return shape;
  });
  put(zip, vmlPath, vml);
}

// ---------------------------------------------------------------------------
// Photo (item 42 box on page 4)
// ---------------------------------------------------------------------------

async function addPhoto(zip: JSZip, photo: PdsPhoto): Promise<void> {
  const drawingPath = "xl/drawings/drawing2.xml"; // page 4's drawing (holds the PHOTO text box)
  const drawing = await zip.file(drawingPath)?.async("string");
  if (!drawing) return;

  const mediaName = `pdsphoto.${photo.extension === "jpeg" ? "jpeg" : "png"}`;
  put(zip, `xl/media/${mediaName}`, photo.bytes);

  const relsPath = "xl/drawings/_rels/drawing2.xml.rels";
  const imageRel = `<Relationship Id="rIdPdsPhoto" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaName}"/>`;
  const existingRels = await zip.file(relsPath)?.async("string");
  put(
    zip,
    relsPath,
    existingRels
      ? existingRels.replace("</Relationships>", `${imageRel}</Relationships>`)
      : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${imageRel}</Relationships>`,
  );

  const typesPath = "[Content_Types].xml";
  let types = await zip.file(typesPath)!.async("string");
  const ext = photo.extension === "jpeg" ? "jpeg" : "png";
  if (!new RegExp(`<Default Extension="${ext}"`, "i").test(types)) {
    types = types.replace(
      /(<Types\b[^>]*>)/,
      `$1<Default Extension="${ext}" ContentType="image/${ext === "jpeg" ? "jpeg" : "png"}"/>`,
    );
    put(zip, typesPath, types);
  }

  // Same cells as the template's own "Passport-sized picture" text box (Text Box 100), so the
  // photo sits exactly where that placeholder is, on top of it.
  const anchor =
    `<xdr:twoCellAnchor editAs="oneCell">` +
    `<xdr:from><xdr:col>11</xdr:col><xdr:colOff>207066</xdr:colOff><xdr:row>50</xdr:row><xdr:rowOff>37270</xdr:rowOff></xdr:from>` +
    `<xdr:to><xdr:col>12</xdr:col><xdr:colOff>952500</xdr:colOff><xdr:row>54</xdr:row><xdr:rowOff>418270</xdr:rowOff></xdr:to>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="9001" name="Employee Photo"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rIdPdsPhoto"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic>` +
    `<xdr:clientData/></xdr:twoCellAnchor>`;
  put(zip, drawingPath, drawing.replace("</xdr:wsDr>", `${anchor}</xdr:wsDr>`));
}

// ---------------------------------------------------------------------------
// Filling the form
// ---------------------------------------------------------------------------

function fillAddress(ed: SheetEditor, a: PdsAddress, rows: { top: number; mid: number; low: number; zip: number }) {
  const setIf = (ref: string, v: string | null) => v && ed.set(ref, s(v));
  setIf(`I${rows.top}`, a.houseBlockLot);
  setIf(`L${rows.top}`, a.street);
  setIf(`I${rows.mid}`, a.subdivision);
  setIf(`L${rows.mid}`, a.barangay);
  setIf(`I${rows.low}`, a.cityMunicipality);
  setIf(`L${rows.low}`, a.province);
  setIf(`I${rows.zip}`, a.zipCode);
}

export async function buildPdsXlsx(
  template: ArrayBuffer | Uint8Array,
  employee: Employee,
  photo?: PdsPhoto | null,
): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(template);
  const editors = {} as Record<SheetKey, SheetEditor>;
  for (const key of Object.keys(SHEET_PART) as SheetKey[]) {
    editors[key] = new SheetEditor(await zip.file(`xl/worksheets/sheet${SHEET_PART[key]}.xml`)!.async("string"));
  }
  const { C1, C2, C3, C4, C5, C6, C7, C8, C9, C10, C11 } = editors;

  const p = employee.pds;
  const name = getNameParts(employee);
  const c1Checks = new Map<string, boolean>();
  const c4Checks = new Map<string, boolean>();

  // ---- Page 1 · I. Personal Information -------------------------------------------------
  C1.set("D10", name.lastName);
  C1.set("D11", name.firstName);
  C1.set("N11", name.nameExtension);
  C1.set("D12", name.middleName);
  C1.set("D13", toDMY(employee.dob));
  C1.set("D15", s(p.placeOfBirth));

  const sex = s(p.sexAtBirth).toLowerCase();
  c1Checks.set("D16", sex === "male");
  c1Checks.set("E16", sex === "female");

  const civil = s(employee.civilStatus).toLowerCase();
  const civilKnown = ["single", "married", "widowed", "separated"];
  const isOther = !!civil && !civilKnown.includes(civil) && !civil.startsWith("widow");
  c1Checks.set("D17", civil === "single");
  c1Checks.set("E17", civil === "married");
  c1Checks.set("D18", civil.startsWith("widow"));
  c1Checks.set("E19", civil === "separated");
  c1Checks.set("D20", isOther);
  if (isOther && civil !== "others" && civil !== "other") C1.set("E20", s(employee.civilStatus));

  C1.set("D22", s(p.heightM));
  C1.set("D24", s(p.weightKg));
  C1.set("D25", s(p.bloodType));
  C1.set("D27", s(p.gsisUmidNo));
  C1.set("D29", s(p.pagibigNo));
  C1.set("D31", s(p.philhealthNo));
  C1.set("D32", s(p.philsysNumber));
  C1.set("D33", s(p.tinNo));
  C1.set("D34", s(p.agencyEmployeeNo));

  // 16. Citizenship — "Filipino" / "Dual Citizenship" (by birth | by naturalization) + country dropdown
  const dual = !!s(p.dualCitizenshipBasis) || !!s(p.dualCitizenshipCountry);
  const citizenship = s(employee.nationality).toLowerCase();
  c1Checks.set("J13", citizenship.startsWith("filipin") || citizenship === "philippines" || dual);
  c1Checks.set("K13", dual);
  c1Checks.set("L14", s(p.dualCitizenshipBasis).toLowerCase().includes("birth"));
  c1Checks.set("M14", s(p.dualCitizenshipBasis).toLowerCase().includes("naturaliz"));
  const countryIndex = pdsCountryIndex(p.dualCitizenshipCountry);
  if (countryIndex) C1.set("J16", countryIndex);

  // 17 / 18. Addresses (the 2026 form has no "same as residential" box, so repeat the values)
  fillAddress(C1, p.residentialAddress, { top: 17, mid: 19, low: 22, zip: 24 });
  fillAddress(C1, p.permanentSameAsResidential ? p.residentialAddress : p.permanentAddress, {
    top: 25,
    mid: 27,
    low: 29,
    zip: 31,
  });
  C1.set("I32", s(p.telephoneNo));
  C1.set("I33", s(p.mobileNo) || s(employee.contact));
  C1.set("I34", s(employee.email));

  // ---- Page 1 · II. Family Background ---------------------------------------------------
  C1.set("D36", s(p.spouseSurname));
  C1.set("D37", s(p.spouseFirstName));
  C1.set("H37", s(p.spouseNameExtension));
  C1.set("D38", s(p.spouseMiddleName));
  C1.set("D39", s(p.spouseOccupation));
  C1.set("D40", s(p.spouseEmployer));
  C1.set("D41", s(p.spouseBusinessAddress));
  C1.set("D42", s(p.spouseTelephone));
  C1.set("D44", s(p.fatherSurname));
  C1.set("D45", s(p.fatherFirstName));
  C1.set("H45", s(p.fatherNameExtension));
  C1.set("D46", s(p.fatherMiddleName));
  C1.set("D48", s(p.motherMaidenSurname));
  C1.set("D49", s(p.motherFirstName));
  C1.set("D50", s(p.motherMiddleName));

  // 23. Children — 13 lines on page 1, the rest on C7
  const childrenLeft = fillRows(C1, p.children, 37, 13, (c) => ({ I: s(c.name), M: toDMY(c.dob) }));
  fillRows(C7, childrenLeft, 4, 20, (c) => ({ I: s(c.name), L: toDMY(c.dob) }));

  // ---- Page 1 · III. Educational Background ---------------------------------------------
  const usedLevels = new Set<number>();
  const eduOverflow = employee.education.filter((e) => {
    const row = levelRow(e.level);
    if (row === null || usedLevels.has(row)) return true;
    usedLevels.add(row);
    C1.set(`D${row}`, s(e.schoolName));
    C1.set(`G${row}`, s(e.degree));
    C1.set(`J${row}`, s(e.periodFrom));
    C1.set(`K${row}`, s(e.periodTo));
    C1.set(`L${row}`, s(e.highestLevelUnits));
    C1.set(`M${row}`, s(e.yearGraduated));
    C1.set(`N${row}`, s(e.honors));
    return false;
  });
  fillRows(C8, eduOverflow, 6, 37, (e) => ({
    A: s(e.level),
    D: s(e.schoolName),
    G: s(e.degree),
    J: s(e.periodFrom),
    K: s(e.periodTo),
    L: s(e.highestLevelUnits),
    M: s(e.yearGraduated),
    N: s(e.honors),
  }));

  // ---- Page 2 · IV. Civil Service Eligibility (27) --------------------------------------
  const eligLeft = fillRows(C2, employee.civilServiceEligibility, 5, 7, (r) => ({
    A: s(r.name),
    F: s(r.rating),
    G: toDMY(r.examDate),
    I: s(r.examPlace),
    L: s(r.licenseNumber),
    M: toDMY(r.licenseValidUntil),
  }));
  fillRows(C9, eligLeft, 5, 24, (r) => ({
    A: s(r.name),
    F: s(r.rating),
    G: toDMY(r.examDate),
    I: s(r.examPlace),
    J: s(r.licenseNumber),
    K: toDMY(r.licenseValidUntil),
  }));

  // ---- Page 2 · V. Work Experience (28) --------------------------------------------------
  const workCells = (w: Employee["workExperience"][number]): CellMap => ({
    A: toDMY(w.fromDate),
    C: w.toDate ? toDMY(w.toDate) : "Present",
    D: s(w.position),
    G: s(w.company),
    J: s(w.monthlySalary),
    K: s(w.salaryGrade),
    L: s(w.statusOfAppointment),
    M: w.govtService === "Y" ? "Y" : w.govtService === "N" ? "N" : "",
  });
  const workLeft = fillRows(C2, employee.workExperience, 18, 24, workCells);
  fillRows(C6, workLeft, 7, 33, workCells);

  // ---- Page 3 · VI. Learning and Development (29) ---------------------------------------
  const ldCells = (t: Employee["training"][number]): CellMap => ({
    A: s(t.course),
    E: toDMY(t.fromDate),
    F: toDMY(t.completed),
    G: s(t.hours),
    H: s(t.ldType),
    I: s(t.conductedBy) || s(t.provider),
  });
  const ldLeft = fillRows(C3, employee.training, 5, 17, ldCells);
  fillRows(C5, ldLeft, 6, 44, ldCells);

  // ---- Page 3 · VII. Voluntary Work (30) --------------------------------------------------
  const volCells = (v: Employee["voluntaryWork"][number]): CellMap => ({
    A: s(v.organization),
    E: toDMY(v.fromDate),
    F: v.toDate ? toDMY(v.toDate) : "",
    G: s(v.hours),
    H: s(v.position),
  });
  const volLeft = fillRows(C3, employee.voluntaryWork, 27, 9, volCells);
  fillRows(C10, volLeft, 6, 29, volCells);

  // ---- Page 3 · VIII. Other Information (31–33) -------------------------------------------
  const skills = splitLines(p.specialSkillsHobbies);
  const distinctions = splitLines(p.nonAcademicDistinctions);
  const memberships = splitLines(p.orgMemberships);
  const otherRows = Math.min(Math.max(skills.length, distinctions.length, memberships.length), 7 + 31);
  for (let i = 0; i < otherRows; i++) {
    // Page 3 has 7 lines (rows 39–45); the rest continue on C11 (rows 4–34).
    const ed = i < 7 ? C3 : C11;
    const row = i < 7 ? 39 + i : 4 + (i - 7);
    if (skills[i]) ed.set(`A${row}`, skills[i]);
    if (distinctions[i]) ed.set(`C${row}`, distinctions[i]);
    if (memberships[i]) ed.set(`I${row}`, memberships[i]);
  }

  // ---- Page 4 · Questions 34–40 -----------------------------------------------------------
  const yesNo = (yesCell: string, noCell: string, answer: boolean | null) => {
    c4Checks.set(yesCell, answer === true);
    c4Checks.set(noCell, answer === false);
  };
  yesNo("H3", "J3", p.q34RelatedThirdDegree);
  yesNo("H8", "J8", p.q34RelatedFourthDegree);
  yesNo("H13", "J13", p.q35aAdminOffense);
  yesNo("H18", "J18", p.q35bCriminalCharge);
  yesNo("H23", "J23", p.q36Convicted);
  yesNo("H27", "J27", p.q37Separated);
  yesNo("H31", "J31", p.q38aCandidate);
  yesNo("H34", "J34", p.q38bResigned);
  yesNo("H37", "J37", p.q39Immigrant);
  yesNo("H43", "J43", p.q40aIndigenous);
  yesNo("H45", "J45", p.q40bPwd);
  yesNo("H47", "J47", p.q40cSoloParent);

  // "If YES, give details" lines — only filled when the answer is Yes. The label cell
  // ("If YES, give details: ____") is left as printed; the text goes on the line(s) below it.
  const detailLines = (text: string | null, first: string, second?: string) => {
    const [l1, l2] = splitForLines(s(text), second ? 62 : 9999);
    C4.set(first, l1);
    if (second && l2) C4.set(second, l2);
  };
  if (p.q34RelatedThirdDegree) detailLines(p.q34Details, "H5", "I6");
  if (p.q34RelatedFourthDegree) detailLines(p.q34Details, "I11", "J12");
  if (p.q35aAdminOffense) detailLines(p.q35aDetails, "I15", "J16");
  if (p.q35bCriminalCharge) {
    C4.set("L19", s(p.q35bDetails));
    C4.set("L20", toDMY(p.q35bDateFiled));
    C4.set("L21", s(p.q35bStatus));
  }
  if (p.q36Convicted) detailLines(p.q36Details, "I25", "J26");
  if (p.q37Separated) detailLines(p.q37Details, "I29");
  if (p.q38aCandidate) C4.set("L32", s(p.q38aDetails));
  if (p.q38bResigned) C4.set("L35", s(p.q38bDetails));
  if (p.q39Immigrant) C4.set("I39", s(p.q39Country));
  if (p.q40aIndigenous) C4.set("K44", s(p.q40aDetails));
  if (p.q40bPwd) C4.set("K46", s(p.q40bIdNo));
  if (p.q40cSoloParent) C4.set("K48", s(p.q40cIdNo));

  // ---- Page 4 · 41. References (3 lines) and 42. Government ID ---------------------------
  fillRows(C4, employee.pdsReferences, 52, 3, (r) => ({ A: s(r.name), G: s(r.address), H: s(r.contact) }));
  C4.set("D61", s(p.govIdType));
  C4.set("D62", s(p.govIdNumber));
  C4.set("D64", [toDMY(p.govIdDateIssued), s(p.govIdPlaceIssued)].filter(Boolean).join(", "));

  // ---- Write the changed parts back ---------------------------------------------------------
  // Each checkbox is linked to a cell that holds TRUE/FALSE.
  for (const [ref, v] of c1Checks) C1.set(ref, v);
  for (const [ref, v] of c4Checks) C4.set(ref, v);
  for (const key of Object.keys(SHEET_PART) as SheetKey[]) {
    put(zip, `xl/worksheets/sheet${SHEET_PART[key]}.xml`, editors[key].toString());
  }
  await syncControls(zip, SHEET_PART.C1, c1Checks, countryIndex ? { link: "J16", index: countryIndex } : undefined);
  await syncControls(zip, SHEET_PART.C4, c4Checks);
  if (photo) await addPhoto(zip, photo);

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ---------------------------------------------------------------------------
// Browser entry point
// ---------------------------------------------------------------------------

async function loadPhoto(url: string | null): Promise<PdsPhoto | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    const extension = type.includes("png") ? "png" : type.includes("jpeg") || type.includes("jpg") ? "jpeg" : null;
    if (!extension) return null;
    return { bytes: new Uint8Array(await res.arrayBuffer()), extension };
  } catch {
    return null;
  }
}

/** Downloads the employee's PDS as a filled-in CS Form 212 (Revised 2026) workbook. */
export async function exportPdsWorkbook(employee: Employee): Promise<void> {
  const res = await fetch(PDS_TEMPLATE_URL);
  if (!res.ok) throw new Error("Could not load the CS Form 212 template.");
  const template = await res.arrayBuffer();
  const photo = await loadPhoto(employee.photoUrl);
  const bytes = await buildPdsXlsx(template, employee, photo);
  const { lastName, firstName } = getNameParts(employee);
  const who =
    [lastName, firstName]
      .filter(Boolean)
      .join("_")
      .replace(/[^\w-]+/g, "_") || employee.employeeNumber;
  downloadWorkbookBuffer(bytes, `PDS_${who}_CS_Form_212_Rev2026.xlsx`);
}
