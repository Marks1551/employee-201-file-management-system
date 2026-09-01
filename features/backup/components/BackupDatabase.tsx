'use client';

import { useState } from 'react';
import { Database, ShieldCheck, Clock } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { Card, Button } from '@/shared/components/ui';
import { useApp } from '@/shared/context/AppContext';
import { useToast } from '@/shared/context/ToastContext';

export default function BackupDatabase() {
  const { meta, backupNow, employees, users } = useApp();
  const showToast = useToast();
  const [running, setRunning] = useState(false);

  function handleBackup() {
    setRunning(true);
    backupNow()
      .then((stamp) => showToast(`Backup completed at ${stamp}.`))
      .catch((err) => showToast(err.message || 'Backup failed.'))
      .finally(() => setRunning(false));
  }

  return (
    <Layout role="admin" eyebrow="Admin › Backup" title="Backup Database">
      <p className="text-ink-muted mb-6">Keep a safe, up-to-date copy of all employee records, documents, and account data.</p>

      <Card className="flex flex-col md:flex-row md:items-center gap-5 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-hr-bg text-hr-text flex items-center justify-center flex-shrink-0">
          <Database size={28} />
        </div>
        <div className="flex-1">
          <div className="text-[0.86rem] text-ink-faint flex items-center gap-1.5 mb-1">
            <Clock size={14} /> Last successful backup
          </div>
          <div className="font-display text-xl font-bold text-navy-dark">{meta.lastBackup}</div>
        </div>
        <Button onClick={handleBackup} disabled={running} variant="gold">
          {running ? 'Backing up…' : 'Back Up Now'}
        </Button>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="mb-1">{employees.length} employee records</h3>
            <p className="m-0 text-[0.86rem] text-ink-muted">Personal info, documents, and training history included in every backup.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="mb-1">{users.length} user accounts</h3>
            <p className="m-0 text-[0.86rem] text-ink-muted">Account details and role assignments are backed up alongside records.</p>
          </div>
        </Card>
        <Card className="flex items-start gap-3">
          <ShieldCheck size={22} className="text-hr-text flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="mb-1">Automatic daily backup</h3>
            <p className="m-0 text-[0.86rem] text-ink-muted">The system also runs a scheduled backup every day at 2:00 AM.</p>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
