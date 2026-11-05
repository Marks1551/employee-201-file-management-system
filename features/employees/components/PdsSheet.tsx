"use client";

/**
 * Visual building blocks that reproduce the printed CS Form No. 212 (Revised 2026):
 * grey label cells, black cell borders, dark-grey section bars, red "(Continue on sheet …)"
 * notes and per-page footers. Values render as plain text when the form is read-only and
 * turn into inline inputs when it is being edited — like filling in the paper form.
 */

import type { ReactNode } from "react";
import { toInputDate, fromInputDate, toInputDateDMY, fromInputDateDMY } from "@/shared/lib/dateFormat";

export const LINE = "border-neutral-700";
export const LABEL_BG = "bg-[#e4e4e4]";

/** Header cell used in the form's column-heading rows. */
export const thCls = `border ${LINE} ${LABEL_BG} px-1 py-1 text-[10px] font-normal leading-tight text-center text-black align-middle`;
/** Body cell used in the form's record tables. */
export const tdCls = `border ${LINE} px-1.5 py-1 align-top text-[12px] text-black break-words`;

/** "March 11, 2025" / "2025-03-11" → "11/03/2025" (the form's dd/mm/yyyy). Anything else is shown as typed. */
export function fmtDMY(v: string | null | undefined): string {
  if (!v) return "";
  const iso = toInputDate(v);
  if (!iso) return v;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** One printed page of the form. */
export function Sheet({ page, total = 4, children }: { page: number; total?: number; children: ReactNode }) {
  return (
    <div className="pds-page overflow-x-auto scrollbar-thin rounded-xl border border-border-strong bg-neutral-200 p-2 md:p-4">
      <div className="pds-page-inner mx-auto min-w-[880px] max-w-[1040px] border-2 border-neutral-800 bg-white font-[Arial,Helvetica,sans-serif] text-[12px] text-black">
        {children}
      </div>
      <p className="pds-page-foot mx-auto m-0 mt-1.5 max-w-[1040px] text-right text-[10px] italic text-neutral-600">
        CS FORM 212 (Revised 2026), Page {page} of {total}
      </p>
    </div>
  );
}

export function SheetHeader() {
  return (
    <>
      <div className={`relative border-b ${LINE} px-2 pt-1 pb-2`}>
        <div className="text-[11px] font-bold italic leading-tight">
          <div>CS Form No. 212</div>
          <div className="font-normal">Revised 2026</div>
        </div>
        <div className="mt-[-12px] text-center text-[22px] font-bold tracking-wide">PERSONAL DATA SHEET</div>
      </div>
      <div className={`border-b ${LINE} px-2 py-1 text-[10.5px] leading-snug`}>
        <p className="m-0 font-bold italic">
          WARNING: Any misrepresentation made in the Personal Data Sheet and the Work Experience Sheet shall cause the
          filing of administrative/criminal case/s against the person concerned.
        </p>
        <p className="m-0 mt-1 font-bold">
          READ THE ATTACHED GUIDE TO FILLING OUT THE PERSONAL DATA SHEET (PDS) BEFORE ACCOMPLISHING THE PDS FORM.
        </p>
        <p className="m-0">
          Tick appropriate boxes (☐) and use separate sheet if necessary. Indicate N/A if not applicable. DO NOT
          ABBREVIATE.
        </p>
      </div>
    </>
  );
}

export function SectionBar({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className={`border-y ${LINE} bg-[#8f8f8f] px-2 py-0.5 text-white`}>
      <div className="text-[13px] font-bold italic">{children}</div>
      {note && <div className="text-[10.5px] font-bold italic leading-tight">{note}</div>}
    </div>
  );
}

export function ContinueNote({ sheet }: { sheet: string }) {
  return (
    <div className={`border-t ${LINE} bg-[#efefef] py-0.5 text-center text-[10.5px] font-bold italic text-red-600`}>
      (Continue on sheet {sheet} if necessary)
    </div>
  );
}

/** Signature / date strip printed at the foot of pages 1–3. Purely visual. */
export function SignatureRow() {
  return (
    <div className={`flex border-t-2 border-neutral-800 text-[12px]`}>
      <div className={`flex w-[17%] items-center justify-center border-r ${LINE} ${LABEL_BG} py-3 font-bold italic`}>
        SIGNATURE
      </div>
      <div className={`flex flex-1 items-center justify-center border-r ${LINE} text-[10.5px] font-bold text-red-600`}>
        (e-signature/digital certificate)
      </div>
      <div className={`flex w-[13%] items-center justify-center border-r ${LINE} ${LABEL_BG} font-bold italic`}>
        DATE
      </div>
      <div className="w-[22%]" />
    </div>
  );
}

/** A grey label cell + value cell(s). `n` is the printed item number. */
export function Row({
  n,
  label,
  children,
  labelW = "w-[38%]",
  className = "",
}: {
  n?: string;
  label: ReactNode;
  children?: ReactNode;
  labelW?: string;
  className?: string;
}) {
  return (
    <div className={`flex min-h-[30px] border-b ${LINE} ${className}`}>
      <div
        className={`${labelW} flex shrink-0 items-center gap-1.5 border-r ${LINE} ${LABEL_BG} px-2 py-1 text-[10.5px] uppercase leading-tight`}
      >
        <span className="w-4 shrink-0">{n}</span>
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Small grey caption cell with its value stacked underneath (e.g. NAME EXTENSION). */
export function Captioned({
  caption,
  children,
  className = "",
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col border-l ${LINE} ${className}`}>
      <div className={`border-b ${LINE} ${LABEL_BG} px-1.5 py-0.5 text-[9px] uppercase leading-tight`}>{caption}</div>
      <div className="flex flex-1">{children}</div>
    </div>
  );
}

type TxtKind = "text" | "date" | "dateDMY" | "email";

interface TxtProps {
  value: string | null | undefined;
  onChange?: (v: string | null) => void;
  disabled?: boolean;
  kind?: TxtKind;
  placeholder?: string;
  multiline?: boolean;
  minH?: string;
  className?: string;
  max?: string;
}

/** Text value: plain text when `disabled`, otherwise an inline input that fills the cell. */
export function Txt({
  value,
  onChange,
  disabled,
  kind = "text",
  placeholder,
  multiline,
  minH,
  className = "",
  max,
}: TxtProps) {
  const shown = kind === "date" || kind === "dateDMY" ? fmtDMY(value) : value || "";
  if (disabled) {
    return (
      <div
        className={`min-h-[28px] min-w-0 flex-1 whitespace-pre-wrap break-words px-2 py-1 text-[12.5px] ${minH || ""} ${className}`}
      >
        {shown}
      </div>
    );
  }
  const edit =
    "w-full min-w-0 flex-1 bg-amber-50 px-2 py-1 text-[12.5px] text-black outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-navy";
  if (multiline) {
    return (
      <div className={`flex min-w-0 flex-1 ${className}`}>
        <textarea
          className={`${edit} ${minH || "min-h-[120px]"} resize-y`}
          value={value || ""}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value || null)}
        />
      </div>
    );
  }
  if (kind === "date" || kind === "dateDMY") {
    const toIn = kind === "date" ? toInputDate : toInputDateDMY;
    const fromIn = kind === "date" ? fromInputDate : fromInputDateDMY;
    return (
      <div className={`flex min-h-[28px] min-w-0 flex-1 ${className}`}>
        <input
          type="date"
          className={edit}
          max={max}
          value={toIn(value)}
          onChange={(e) => onChange?.(fromIn(e.target.value) || null)}
        />
      </div>
    );
  }
  return (
    <div className={`flex min-h-[28px] min-w-0 flex-1 ${className}`}>
      <input
        type={kind === "email" ? "email" : "text"}
        className={edit}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value || null)}
      />
    </div>
  );
}

/** Choice value: plain text when `disabled`, otherwise a select that fills the cell. */
export function Pick({
  value,
  onChange,
  disabled,
  options,
  className = "",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  options: readonly string[];
  className?: string;
}) {
  if (disabled) {
    return <div className={`min-h-[28px] min-w-0 flex-1 px-2 py-1 text-[12.5px] ${className}`}>{value || ""}</div>;
  }
  return (
    <div className={`flex min-h-[28px] min-w-0 flex-1 ${className}`}>
      <select
        className="w-full min-w-0 flex-1 bg-amber-50 px-1.5 py-1 text-[12.5px] text-black outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-navy"
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {value && !options.includes(value) && <option value={value}>{value}</option>}
      </select>
    </div>
  );
}

/** The form's tick box (☐ / ☑). Read-only when `disabled`. */
export function Check({
  checked,
  onChange,
  disabled,
  label,
  className = "",
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`inline-flex items-center gap-1.5 bg-transparent p-0 text-left text-[12px] text-black disabled:cursor-default disabled:opacity-100 ${
        disabled ? "" : "cursor-pointer"
      } ${className}`}
    >
      <span
        className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border border-neutral-800 bg-white text-[11px] font-bold leading-none ${
          disabled ? "" : "ring-1 ring-amber-300"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      {label}
    </button>
  );
}

/** Address block (items 17 / 18): grey label on the left, the form's 3×2 grid + ZIP on the right. */
export function AddressBlock({
  n,
  label,
  value,
  onChange,
  disabled,
  extraLabel,
}: {
  n: string;
  label: string;
  value: {
    houseBlockLot: string | null;
    street: string | null;
    subdivision: string | null;
    barangay: string | null;
    cityMunicipality: string | null;
    province: string | null;
    zipCode: string | null;
  };
  onChange: (key: keyof typeof value, v: string | null) => void;
  disabled?: boolean;
  extraLabel?: ReactNode;
}) {
  const cell = (key: keyof typeof value, caption: string, last = false) => (
    <div className={`flex flex-1 flex-col ${last ? "" : `border-r ${LINE}`}`}>
      <Txt value={value[key]} onChange={(v) => onChange(key, v)} disabled={disabled} />
      <div className="px-1 pb-0.5 text-center text-[9px] italic text-neutral-600">{caption}</div>
    </div>
  );
  return (
    <div className={`flex border-b ${LINE}`}>
      <div
        className={`flex w-[34%] shrink-0 flex-col justify-between gap-2 border-r ${LINE} ${LABEL_BG} px-2 py-1 text-[10.5px] uppercase leading-tight`}
      >
        <div>
          <span className="mr-1.5">{n}</span>
          {label}
          {extraLabel && <div className="mt-1.5 normal-case">{extraLabel}</div>}
        </div>
        <div>ZIP CODE</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className={`flex border-b ${LINE}`}>
          {cell("houseBlockLot", "House/Block/Lot No.")}
          {cell("street", "Street", true)}
        </div>
        <div className={`flex border-b ${LINE}`}>
          {cell("subdivision", "Subdivision/Village")}
          {cell("barangay", "Barangay", true)}
        </div>
        <div className={`flex border-b ${LINE}`}>
          {cell("cityMunicipality", "City/Municipality")}
          {cell("province", "Province", true)}
        </div>
        <div className="flex">
          <Txt value={value.zipCode} onChange={(v) => onChange("zipCode", v)} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}

/** YES ☐ NO ☐ pair used by questions 34–40. Clicking the ticked box un-ticks it. */
export function YesNo({
  value,
  onChange,
  disabled,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-8">
      <Check
        label="YES"
        checked={value === true}
        disabled={disabled}
        onChange={() => onChange(value === true ? null : true)}
      />
      <Check
        label="NO"
        checked={value === false}
        disabled={disabled}
        onChange={() => onChange(value === false ? null : false)}
      />
    </div>
  );
}

/** "If YES, give details:" followed by a ruled input line. */
export function Detail({
  label,
  value,
  onChange,
  disabled,
  kind,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  kind?: TxtKind;
}) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0 whitespace-nowrap text-[12px]">{label}</span>
      <Txt value={value} onChange={onChange} disabled={disabled} kind={kind} className={`border-b ${LINE}`} />
    </div>
  );
}

/** One question row of items 34–40: grey question on the left, white answer cell on the right. */
export function QRow({
  n,
  letter,
  children,
  answer,
}: {
  n?: string;
  letter?: string;
  children: ReactNode;
  answer?: ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[58%_42%] border-b ${LINE}`}>
      <div className={`flex gap-1.5 border-r ${LINE} ${LABEL_BG} px-2 py-1.5 text-[12px] leading-snug`}>
        <span className="w-5 shrink-0 text-[11px]">{n}</span>
        {letter && <span className="w-4 shrink-0">{letter}</span>}
        <div className="flex-1">{children}</div>
      </div>
      <div className="flex flex-col justify-center gap-1.5 px-3 py-2">{answer}</div>
    </div>
  );
}
