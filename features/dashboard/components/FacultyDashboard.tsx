import Link from 'next/link';
import { FileText, UploadCloud, AlertTriangle, Calendar, CheckCircle2 } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import NoEmployeeLinked from '@/features/employees/components/NoEmployeeLinked';
import { StatCard, ActionTile } from '@/shared/components/ui';
import { useApp } from '@/shared/context/AppContext';

export default function FacultyDashboard() {
  const { currentUser, currentEmployee, ready } = useApp();
  if (!ready) return null;
  if (!currentEmployee || !currentUser) return <NoEmployeeLinked eyebrow="Faculty" title="My Dashboard" />;

  const total = currentEmployee.documents.length;
  const uploaded = currentEmployee.documents.filter((d) => d.status === 'uploaded').length;
  const missing = currentEmployee.documents.filter((d) => d.status === 'missing');

  return (
    <Layout role="faculty" eyebrow="Faculty" title="My Dashboard">
      {missing.length > 0 && (
        <div className="flex gap-3 p-4 rounded-2xl border border-warn-border bg-warn-bg text-warn-text mb-5">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <strong className="block mb-0.5">Your {missing[0].name} is missing</strong>
            Please submit a copy so your 201 file stays complete.{' '}
            <Link href="/faculty/submit" className="underline font-medium">Submit it now</Link>.
          </div>
        </div>
      )}

      <p className="text-ink-muted mb-5">Welcome, {currentUser.name.split(' ')[0]}. Here's a quick look at your employee file.</p>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-8">
        <StatCard icon={CheckCircle2} color="green" value={`${uploaded} of ${total}`} label="Documents on file" />
        <StatCard icon={AlertTriangle} color="gold" value={missing.length} label="Pending / missing" />
        <StatCard icon={Calendar} color="navy" value={currentEmployee.dateHired} label="Date hired" />
      </div>

      <div>
        <h2 className="mb-3.5">What would you like to do?</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ActionTile to="/faculty/201file" icon={FileText} iconBg="bg-faculty-bg text-faculty-text" title="View My 201 File" description="See your personal info and document status." />
          <ActionTile to="/faculty/submit" icon={UploadCloud} iconBg="bg-admin-bg text-admin-text" title="Submit a Document" description="Upload a missing or updated file for HR to review." />
        </div>
      </div>
    </Layout>
  );
}
