'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel?: string;
}

function pageList(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({ page, totalPages, onPageChange, totalItems, startIndex, endIndex, itemLabel = 'results' }: PaginationProps) {
  if (totalItems === 0) return null;

  const btnBase =
    'inline-flex items-center justify-center min-h-[38px] min-w-[38px] px-2.5 rounded-lg font-semibold text-[0.86rem] border-[1.5px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap mt-3.5">
      <p className="text-ink-faint text-[0.86rem] m-0">
        Showing {startIndex}–{endIndex} of {totalItems} {itemLabel}.
      </p>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1.5" aria-label="Pagination">
          <button
            type="button"
            className={`${btnBase} bg-white text-navy border-border-strong hover:bg-navy-100`}
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {pageList(page, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-1.5 text-ink-faint text-[0.86rem] select-none">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`${btnBase} ${
                  p === page ? 'bg-navy text-white border-navy' : 'bg-white text-navy border-border-strong hover:bg-navy-100'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            type="button"
            className={`${btnBase} bg-white text-navy border-border-strong hover:bg-navy-100`}
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
