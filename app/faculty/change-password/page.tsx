'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import ChangePasswordPage from '@/shared/components/ChangePasswordPage';

export default function Page() {
  return (
    <ProtectedRoute role="faculty">
      <ChangePasswordPage role="faculty" />
    </ProtectedRoute>
  );
}
