import type { DocumentRecord } from '@/shared/types';

/** An employee's 201 file is only "Complete" when every document is on file
 *  AND none are sitting in a rejected state — a rejected document still needs
 *  the employee to submit a replacement, so it should never read as done. */
export function documentCompletion(documents: DocumentRecord[]): {
  missingCount: number;
  rejectedCount: number;
  isComplete: boolean;
} {
  const missingCount = documents.filter((d) => d.status === 'missing').length;
  const rejectedCount = documents.filter((d) => d.status === 'rejected').length;
  return { missingCount, rejectedCount, isComplete: missingCount === 0 && rejectedCount === 0 };
}
