'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import AssignRoles from '@/features/users/components/AssignRoles';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <AssignRoles />
    </ProtectedRoute>
  );
}
