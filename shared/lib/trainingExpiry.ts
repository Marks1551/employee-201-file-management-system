import { toInputDate } from "@/shared/lib/dateFormat";

export interface CertExpiry {
  /** Whole days from today until the expiry date (negative once it has passed). */
  daysLeft: number;
  expired: boolean;
}

/** Expiry info for a training whose certificate is "expiring soon" and has an exact date;
 *  null when there is no usable date. */
export function certExpiry(t: { certStatus: string; expiresOn?: string | null }): CertExpiry | null {
  if (t.certStatus !== "expiring" || !t.expiresOn) return null;
  const iso = toInputDate(t.expiresOn);
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysLeft = Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86400000);
  return { daysLeft, expired: daysLeft < 0 };
}

/** Plain-text certificate status for exports and printouts. */
export function certStatusText(t: { certStatus: string; expiresOn?: string | null }): string {
  if (t.certStatus === "on-file") return "On file";
  return t.expiresOn ? `Expiring soon (expires ${t.expiresOn})` : "Expiring soon";
}
