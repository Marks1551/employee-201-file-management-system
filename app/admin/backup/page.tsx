'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import BackupDatabase from '@/features/backup/components/BackupDatabase';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <BackupDatabase />
    </ProtectedRoute>
  );
}
