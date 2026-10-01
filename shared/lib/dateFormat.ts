const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Converts a stored date string ("March 11, 2025" or "2025-03-11") into the
 *  yyyy-mm-dd value an <input type="date"> needs. Unreadable values give ''. */
export function toInputDate(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // "March 2022" (month + year only) -> first of that month, so it still shows in the picker
  const my = v.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (my) {
    const mi = MONTHS.findIndex((n) => n.toLowerCase().startsWith(my[1].toLowerCase().slice(0, 3)));
    return mi < 0 ? "" : `${my[2]}-${String(mi + 1).padStart(2, "0")}-01`;
  }
  const m = v.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (!m) return "";
  const month = MONTHS.findIndex((n) => n.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
  if (month < 0) return "";
  return `${m[3]}-${String(month + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** Converts a date picker value (yyyy-mm-dd) back into the app's stored
 *  format, e.g. "March 11, 2025", so exports and displays stay unchanged. */
export function fromInputDate(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** Children's birth dates in the PDS are stored as dd/mm/yyyy. */
export function toInputDateDMY(value: string | null | undefined): string {
  if (!value) return "";
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return toInputDate(value);
}

export function fromInputDateDMY(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
