"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, ChevronDown, Check } from "lucide-react";

export interface TabMenuOption {
  key: string;
  label: ReactNode;
  /** Optional small count shown next to the label (e.g. number of documents). */
  badge?: number;
}

interface TabMenuProps {
  options: TabMenuOption[];
  value: string;
  onChange: (key: string) => void;
  /** Accessible name for the menu button. */
  ariaLabel?: string;
}

/** Mobile-friendly replacement for a long row of tabs: one button showing the
 *  current subpage; tapping it opens a list of every subpage to jump to. */
export default function TabMenu({ options, value, onChange, ariaLabel = "Choose a section" }: TabMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.key === value) || options[0];

  // Close when tapping outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 min-h-[48px] px-4 rounded-xl bg-white border-[1.5px] border-border-strong text-navy font-semibold text-[0.95rem] cursor-pointer"
      >
        <Menu size={20} className="flex-shrink-0" />
        <span className="flex-1 text-left truncate">{current?.label}</span>
        {current?.badge !== undefined && (
          <span className="text-[0.78rem] px-2 py-0.5 rounded-full bg-navy-100 text-navy">{current.badge}</span>
        )}
        <ChevronDown size={18} className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full mt-2 z-30 m-0 p-1.5 list-none bg-white border border-border rounded-xl shadow-pop max-h-[60vh] overflow-y-auto"
        >
          {options.map((o) => {
            const active = o.key === current?.key;
            return (
              <li key={o.key} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.key);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 min-h-[46px] px-3.5 rounded-lg text-left text-[0.94rem] font-medium cursor-pointer border-none ${
                    active ? "bg-navy-100 text-navy font-semibold" : "bg-transparent text-ink hover:bg-navy-100"
                  }`}
                >
                  <span className="flex-1">{o.label}</span>
                  {o.badge !== undefined && (
                    <span className="text-[0.78rem] px-2 py-0.5 rounded-full bg-navy-100 text-navy">{o.badge}</span>
                  )}
                  {active && <Check size={16} className="flex-shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
