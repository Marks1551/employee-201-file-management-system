import { Users, ClipboardCheck, Database, CheckSquare, ClipboardList } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { StatCard, ActionTile } from '@/shared/components/ui';
import { TableWrap, Th, Td, CellName, CellSub } from '@/shared/components/Table';
import { useApp } from '@/shared/context/AppContext';
import Link from 'next/link';

export default function AdminDashboard() {
  const { currentUser, users, auditLog, meta } = useApp();
  const activeUsers = users.filter((u) => u.status === 'active').length;

  return (
    <Layout role="admin" eyebrow="System Administrator" title="Admin Dashboard">
      <p className="text-ink-muted mb-5">Welcome back, {currentUser?.name.split(' ')[0]}. Here's what's happening across the system today.</p>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-8">
        <StatCard icon={Users} color="navy" value={activeUsers} label="Active user accounts" />
        <StatCard icon={ClipboardCheck} color="gold" value={auditLog.length} label="Actions logged" />
        <StatCard icon={Database} color="green" value={meta.lastBackup} label="Last successful backup" />
      </div>

      <div className="mb-8">
        <h2 className="mb-3.5">What would you like to do?</h2>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          <ActionTile to="/admin/users" icon={Users} iconBg="bg-navy-100 text-navy" title="Manage User Accounts" description="Create, edit, or deactivate accounts for HR and Faculty staff." />
          <ActionTile to="/admin/roles" icon={CheckSquare} iconBg="bg-admin-bg text-admin-text" title="Assign User Roles" description="Set each account's role: Admin, HR Personnel, or Faculty." />
          <ActionTile to="/admin/backup" icon={Database} iconBg="bg-hr-bg text-hr-text" title="Backup Database" description="Keep a safe, up-to-date copy of all employee records." />
          <ActionTile to="/admin/audit-logs" icon={ClipboardList} iconBg="bg-faculty-bg text-faculty-text" title="View Audit Logs" description="Review a plain-language history of system activity." />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
          <h2>Recent activity</h2>
          <Link href="/admin/audit-logs" className="text-navy font-semibold text-[0.9rem] no-underline hover:underline">
            View all &rsaquo;
          </Link>
        </div>
        <TableWrap>
          <table className="w-full border-collapse min-w-[560px]">
            <thead>
              <tr>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {auditLog.slice(0, 5).map((row) => (
                <tr key={row.id} className="hover:bg-[#FBFAF7]">
                  <Td>
                    <CellName>{row.who}</CellName>
                    {row.role !== 'System' && <CellSub>{row.role}</CellSub>}
                  </Td>
                  <Td>{row.action}</Td>
                  <Td>{row.when}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </div>
    </Layout>
  );
}
