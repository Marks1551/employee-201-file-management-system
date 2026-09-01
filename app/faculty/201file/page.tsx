'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import Faculty201File from '@/features/employees/components/Faculty201File';

export default function Page() {
  return (
    <ProtectedRoute role="faculty">
      <Faculty201File />
    </ProtectedRoute>
  );
}
