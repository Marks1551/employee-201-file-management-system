"use client";

import { Link2Off, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import Layout from "@/shared/components/Layout";
import { Card } from "@/shared/components/ui";
import { useApp } from "@/shared/context/AppContext";

interface NoEmployeeLinkedProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
}

/**
 * Shown to a faculty member who has no usable employee record. Says which situation it is:
 *  - the account was never linked to an employee 201 file, or
 *  - it is linked to a record that can no longer be found (e.g. the record was removed).
 * (A record that exists but was deactivated is handled separately — see InactiveRecordNotice.)
 */
export default function NoEmployeeLinked({ eyebrow, title }: NoEmployeeLinkedProps) {
  const { currentUser } = useApp();
  const linkedButMissing = !!currentUser?.employeeId;

  return (
    <Layout role="faculty" eyebrow={eyebrow} title={title}>
      <Card className="text-center py-12">
        {linkedButMissing ? (
          <SearchX size={36} className="mx-auto mb-3 text-ink-faint" />
        ) : (
          <Link2Off size={36} className="mx-auto mb-3 text-ink-faint" />
        )}
        <h3 className="mb-1.5">
          {linkedButMissing
            ? "We can't find your employee record"
            : "Your account isn't linked to an employee record yet"}
        </h3>
        <p className="text-ink-muted max-w-md mx-auto m-0">
          {linkedButMissing
            ? "Your account points to an employee 201 file that no longer exists or can't be loaded. Please contact the HR office so they can restore the record or link your account to the correct one."
            : "Your login works, but HR hasn't connected it to your employee 201 file yet. Ask the HR office to link your account — once they do, your dashboard, documents and PDS will appear here automatically."}
        </p>
      </Card>
    </Layout>
  );
}
