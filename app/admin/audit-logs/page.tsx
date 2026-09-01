'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import AuditLogs from '@/features/audit-log/components/AuditLogs';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <AuditLogs />
    </ProtectedRoute>
  );
}
