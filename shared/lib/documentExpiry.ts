import { toInputDate, fromInputDate } from "@/shared/lib/dateFormat";

/** Documents that carry an expiry date: PRC (licence / ID) and NBI Clearance. Matched on the
 *  start of the name so variants HR adds ("PRC ID", "NBI Clearance (renewal)") also count. */
const EXPIRY_NAME = /^\s*(prc|nbi)\b/i;

/** How many days before the date a document is flagged "expiring soon". */
export const EXPIRY_WARNING_DAYS = 60;

export function documentNeedsExpiry(name: string | null | undefined): boolean {
  return !!name && EXPIRY_NAME.test(name);
}

export interface DocExpiry {
  /** Whole days from today until the expiry date (negative once it has passed). */
  daysLeft: number;
  expired: boolean;
  /** Not expired yet, but inside the warning window. */
  expiringSoon: boolean;
}

/** Expiry status for an approved (uploaded) document that has an expiry date; null otherwise. */
export function documentExpiry(doc: { status: string; expiresOn?: string | null }): DocExpiry | null {
  if (doc.status !== "uploaded" || !doc.expiresOn) return null;
  const iso = toInputDate(doc.expiresOn);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
  return { daysLeft, expired: daysLeft < 0, expiringSoon: daysLeft >= 0 && daysLeft <= EXPIRY_WARNING_DAYS };
}

/** Human wording for the days remaining, e.g. "Expired 12 days ago", "Expires in 5 days". */
export function expiryPhrase(e: DocExpiry): string {
  const n = Math.abs(e.daysLeft);
  const days = `${n} day${n === 1 ? "" : "s"}`;
  if (e.expired) return `Expired ${days} ago`;
  if (e.daysLeft === 0) return "Expires today";
  return `Expires in ${days}`;
}

/** Validates an expiry date from a form (yyyy-mm-dd) and converts it to the app's stored
 *  format ("March 11, 2025"). An empty value is valid and means "no date". */
export function parseExpiryInput(raw: unknown): { ok: true; value: string | null } | { ok: false } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return { ok: false };
  const iso = raw.trim();
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const real = date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!real || y < 2000 || y > 2100) return { ok: false };
  return { ok: true, value: fromInputDate(iso) };
}

/** Plain text for exports and printouts. */
export function expiryText(doc: { name: string; status: string; expiresOn?: string | null }): string {
  if (!documentNeedsExpiry(doc.name)) return "N/A";
  if (!doc.expiresOn) return doc.status === "uploaded" ? "No expiry date" : "—";
  const e = documentExpiry(doc);
  return e && (e.expired || e.expiringSoon) ? `${doc.expiresOn} (${expiryPhrase(e).toLowerCase()})` : doc.expiresOn;
}
