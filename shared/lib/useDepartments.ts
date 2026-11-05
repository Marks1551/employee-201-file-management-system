"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEPARTMENTS } from "@/shared/lib/roles";

export interface DepartmentInfo {
  name: string;
  employeeCount: number;
}

export type DepartmentResult = { ok: true; name: string } | { ok: false; error: string };

/** Loads the department list (built-in + ones HR added) with employee counts, and lets HR add
 *  or remove departments. Starts with the built-in list so dropdowns are never empty while
 *  loading. */
export function useDepartments() {
  const [details, setDetails] = useState<DepartmentInfo[]>(() =>
    DEPARTMENTS.map((name) => ({ name, employeeCount: 0 })),
  );

  const apply = useCallback((data: { details?: unknown }) => {
    if (Array.isArray(data.details)) setDetails(data.details as DepartmentInfo[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/departments");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) apply(data);
      } catch {
        // keep the built-in list
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const send = useCallback(
    async (method: "POST" | "DELETE", name: string, fallback: string): Promise<DepartmentResult> => {
      try {
        const res = await fetch("/api/departments", {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: data.error || fallback };
        apply(data);
        return { ok: true, name: data.name };
      } catch {
        return { ok: false, error: fallback };
      }
    },
    [apply],
  );

  const addDepartment = useCallback((name: string) => send("POST", name, "Could not add the department."), [send]);
  const removeDepartment = useCallback(
    (name: string) => send("DELETE", name, "Could not remove the department."),
    [send],
  );
  const departments = useMemo(() => details.map((d) => d.name), [details]);

  return { departments, details, addDepartment, removeDepartment };
}
