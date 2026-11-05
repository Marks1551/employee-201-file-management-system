"use client";

import { inputCls } from "@/shared/components/ui";
import { useDepartments } from "@/shared/lib/useDepartments";

/** Department dropdown for the employee forms. The list includes departments HR added from
 *  the Employee Records screen ("Add Department"). */
export default function DepartmentSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (department: string) => void;
  id?: string;
}) {
  const { departments } = useDepartments();

  return (
    <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
      {value && !departments.includes(value) && <option value={value}>{value}</option>}
      {departments.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  );
}
