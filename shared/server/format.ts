// Small formatting helpers shared by multiple features' server code.

/** Formats "Aug 6, 10:12 AM" style timestamps from a raw DB datetime string. */
export function fmt(dateLike: string | null | undefined): string | null {
  if (!dateLike) return null;
  const d = new Date(dateLike.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return dateLike;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

/** "Juan Dela Cruz" -> "JD" */
export function initials(name: string): string {
  return name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}
