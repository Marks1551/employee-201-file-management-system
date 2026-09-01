'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import Reports from '@/features/employees/components/Reports';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <Reports />
    </ProtectedRoute>
  );
}
