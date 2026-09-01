'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import AdminDashboard from '@/features/dashboard/components/AdminDashboard';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <AdminDashboard />
    </ProtectedRoute>
  );
}
