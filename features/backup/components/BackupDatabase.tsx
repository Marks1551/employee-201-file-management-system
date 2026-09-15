"use client";

import { useState } from "react";
import { Database, ShieldCheck, Clock, Download } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Card, Button } from "@/shared/components/ui";
import { useApp } from "@/shared/context/AppContext";
import { useToast } from "@/shared/context/ToastContext";

export default function BackupDatabase() {
  const { meta, backupNow, employees, users } = useApp();
  const showToast = useToast();
  const [running, setRunning] = useState(false);

  async function handleBackup() {
    if (running) return;

    setRunning(true);

    try {
      const stamp = await backupNow();

      showToast(`Backup completed at ${stamp}. The SQL file has been downloaded.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Backup failed. Please try again.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Layout role="admin" eyebrow="Admin › Backup" title="Backup Database">
      <p className="text-ink-muted mb-6">
        Download a complete SQL copy of the Employee 201 database, including employee records, accounts, documents,
        training, attendance, audit logs, and other database records.
      </p>

      <Card className="flex flex-col md:flex-row md:items-center gap-5 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-hr-bg text-hr-text flex items-center justify-center flex-shrink-0">
          <Database size={28} />
        </div>

        <div className="flex-1">
          <div className="text-[0.86rem] text-ink-faint flex items-center gap-1.5 mb-1">
            <Clock size={14} />
            Last successful backup
          </div>

          <div className="font-display text-xl font-bold text-navy-dark">{meta.lastBackup || "No backup yet"}</div>
        </div>

        <Button onClick={handleBackup} disabled={running} variant="gold">
          <Download size={17} className="mr-2" />

          {running ? "Creating backup…" : "Back Up Now"}
        </Button>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />

          <div>
            <h3 className="mb-1">{employees.length} employee records</h3>

            <p className="m-0 text-[0.86rem] text-ink-muted">
              Employee information and related database records are included in the SQL backup.
            </p>
          </div>
        </Card>

        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />

          <div>
            <h3 className="mb-1">{users.length} user accounts</h3>

            <p className="m-0 text-[0.86rem] text-ink-muted">
              User accounts, roles, and account-related database records are included.
            </p>
          </div>
        </Card>

        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />

          <div>
            <h3 className="mb-1">Complete SQL backup</h3>

            <p className="m-0 text-[0.86rem] text-ink-muted">
              The backup contains the database structure and data from all MySQL tables.
            </p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
