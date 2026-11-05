// Pure helpers shared by both server (API routes) and client code.
import type { Role } from "@/shared/types";

export function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "System Administrator";
    case "hr":
      return "HR Personnel";
    case "faculty":
      return "Faculty";
    default:
      return role;
  }
}

/** Maximum number of accounts allowed per role. Roles not listed here are unlimited. */
export const ROLE_LIMITS: Partial<Record<Role, number>> = {
  admin: 3,
  hr: 1,
};

/** Error shown when a role has no free slots left. */
export function roleLimitMessage(role: string): string {
  const limit = ROLE_LIMITS[role as Role];
  if (limit === undefined) return "";
  return `Only ${limit} ${roleLabel(role)} account${limit === 1 ? "" : "s"} allowed. The limit has been reached.`;
}

/** True when assigning `role` to someone would exceed that role's limit.
 *  `excludeUserId` is the account being changed, so it never blocks its own current role. */
export function isRoleFull(users: { id: string; role: string }[], role: string, excludeUserId?: string): boolean {
  const limit = ROLE_LIMITS[role as Role];
  if (limit === undefined) return false;
  const count = users.filter((u) => u.role === role && u.id !== excludeUserId).length;
  return count >= limit;
}

export function roleHome(role: Role | string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "hr":
      return "/hr";
    case "faculty":
      return "/faculty";
    default:
      return "/";
  }
}

/** Reasons selectable when deactivating an employee's 201 file. */
export const DEACTIVATION_REASONS = [
  "Resigned",
  "End of Contract",
  "Retired",
  "Job Abandonment",
  "Terminated",
] as const;

/** Employment status options. Contract end date only applies to Contractual. */
export const EMPLOYMENT_STATUSES = ["Regular", "Contractual"] as const;

/** Departments/colleges selectable for an employee record. */
export const DEPARTMENTS = [
  "College of Midwifery",
  "College of Education",
  "College of Business Administration",
  "College of Criminology",
  "College of Computer Science",
  "Registrar's Office",
] as const;

/** Formats "Aug 6, 10:12 AM" style timestamps, matching the original UI style.
 *  Always renders in Asia/Manila explicitly — never rely on the runtime's
 *  ambient local timezone, since that's UTC on Railway and something else in
 *  dev, and the two silently disagree. */
export function nowStamp(): string {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}
