// Small formatting helpers shared by multiple features' server code.

/** Formats "Aug 6, 10:12 AM" style timestamps from a raw DB datetime string.
 *  The DB pool (see shared/server/db.ts, `timezone: 'Z'`) always hands back
 *  these strings as UTC wall-clock values, so we mark them explicitly as UTC
 *  here (`Z` suffix) and always render in Asia/Manila. Never rely on the
 *  Node process's ambient local timezone — it's UTC on Railway and whatever
 *  your OS is set to in dev, so results differ silently between the two. */
export function fmt(dateLike: string | null | undefined): string | null {
  if (!dateLike) return null;
  const d = new Date(dateLike.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return dateLike;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

/** "Juan Dela Cruz" -> "JD" */
export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
