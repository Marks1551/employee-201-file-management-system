import type { ReactNode } from 'react';

export function TableWrap({ children }: { children?: ReactNode }) {
  return <div className="overflow-x-auto border border-border rounded-2xl bg-white scrollbar-thin">{children}</div>;
}

export function Th({ children }: { children?: ReactNode }) {
  return (
    <th className="text-left text-[0.78rem] uppercase tracking-wide text-ink-muted px-4 md:px-5 py-3.5 bg-navy-100 border-b border-border whitespace-nowrap">
      {children}
    </th>
  );
}

export function Td({ children, className = '', colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-4 md:px-5 py-3.5 border-b border-border text-[0.94rem] align-middle ${className}`}>{children}</td>;
}

export function CellName({ children }: { children?: ReactNode }) {
  return <span className="font-semibold text-ink block">{children}</span>;
}

export function CellSub({ children }: { children?: ReactNode }) {
  return <span className="text-[0.82rem] text-ink-faint block">{children}</span>;
}
