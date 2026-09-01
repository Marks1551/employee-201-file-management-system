// Pure helpers shared by both server (API routes) and client code.
import type { Role } from '@/shared/types';

export function roleLabel(role: string): string {
  switch (role) {
    case 'admin': return 'System Administrator';
    case 'hr': return 'HR Personnel';
    case 'faculty': return 'Faculty';
    default: return role;
  }
}

export function roleHome(role: Role | string): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'hr': return '/hr';
    case 'faculty': return '/faculty';
    default: return '/';
  }
}

/** Reasons selectable when deactivating an employee's 201 file. */
export const DEACTIVATION_REASONS = ['Resigned', 'End of Contract', 'Retired', 'Job Abandonment', 'Terminated'] as const;

/** Employment status options. Contract end date only applies to Contractual. */
export const EMPLOYMENT_STATUSES = ['Regular', 'Contractual'] as const;

/** Departments/colleges selectable for an employee record. */
export const DEPARTMENTS = [
  'College of Midwifery',
  'College of Education',
  'College of Business Administration',
  'College of Criminology',
  'College of Computer Science',
  "Registrar's Office",
] as const;

/** Formats "Aug 6, 10:12 AM" style timestamps, matching the original UI style. */
export function nowStamp(): string {
  return new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}
