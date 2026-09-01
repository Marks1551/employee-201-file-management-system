'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import SubmitDocument from '@/features/employees/components/SubmitDocument';

export default function Page() {
  return (
    <ProtectedRoute role="faculty">
      <SubmitDocument />
    </ProtectedRoute>
  );
}
