import { Archive } from "lucide-react";
import type { Employee } from "@/shared/types";

/** True when HR has marked this employee's 201 file inactive (resigned, retired, etc.). */
export function isRecordInactive(employee: Employee | null | undefined): boolean {
  return !!employee && (employee.status || "active") === "inactive";
}

/**
 * Explains what an inactive record means for the faculty member: the 201 file stays viewable,
 * but submitting documents and editing the PDS are switched off.
 */
export default function InactiveRecordNotice({ employee }: { employee: Employee }) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl border border-warn-border bg-warn-bg text-warn-text mb-5">
      <Archive size={20} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <strong className="block mb-1">Your employee record is inactive</strong>
        <p className="m-0 text-[0.9rem]">
          HR marked your 201 file as inactive
          {employee.deactivationReason ? ` (${employee.deactivationReason})` : ""}
          {employee.deactivatedAt ? ` on ${employee.deactivatedAt}` : ""}. You can still view your records and download
          your files, but you can&apos;t submit documents or edit your PDS while it&apos;s inactive. If this looks
          wrong, please contact the HR office.
        </p>
      </div>
    </div>
  );
}
