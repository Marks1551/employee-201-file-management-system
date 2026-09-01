'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import ChangePasswordPage from '@/shared/components/ChangePasswordPage';

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <ChangePasswordPage role="admin" />
    </ProtectedRoute>
  );
}
