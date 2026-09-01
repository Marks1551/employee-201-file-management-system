'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import AdminUsers from '@/features/users/components/AdminUsers';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <AdminUsers />
    </ProtectedRoute>
  );
}
