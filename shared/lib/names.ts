// Helpers for the PDS-style name fields (Surname / First Name / Middle Name /
// Name Extension). Safe to import from both client and server code.

export interface NameParts {
  firstName: string;
  middleName: string;
  lastName: string;
  nameExtension: string;
}

const clean = (v: string | null | undefined): string => (v || "").trim().replace(/\s+/g, " ");

/** Best-effort split of a legacy single-field name ("First Middle Last") into parts.
 *  Only used for records created before the name was captured as separate fields. */
export function splitName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = clean(fullName).split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "", middleName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" };
  if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] };
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(" "), lastName: parts[parts.length - 1] };
}

/** "Juan Santos Dela Cruz Jr." — full legal name in natural order. */
export function composeFullName(p: Partial<NameParts>): string {
  return [clean(p.firstName), clean(p.middleName), clean(p.lastName), clean(p.nameExtension)].filter(Boolean).join(" ");
}

/** "Juan Dela Cruz Jr." — the shorter name used in lists, headers and toasts (no middle name). */
export function composeDisplayName(p: Partial<NameParts>): string {
  return [clean(p.firstName), clean(p.lastName), clean(p.nameExtension)].filter(Boolean).join(" ");
}

/** Name parts for an employee: the stored PDS parts when present, otherwise a best-effort split of fullName. */
export function getNameParts(employee: {
  fullName: string;
  pds?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    nameExtension?: string | null;
  };
}): NameParts {
  const pds = employee.pds || {};
  if (clean(pds.firstName) || clean(pds.lastName)) {
    return {
      firstName: clean(pds.firstName),
      middleName: clean(pds.middleName),
      lastName: clean(pds.lastName),
      nameExtension: clean(pds.nameExtension),
    };
  }
  return { ...splitName(employee.fullName), nameExtension: clean(pds.nameExtension) };
}
