'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import HREmployeeFile from '@/features/employees/components/EmployeeFile';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <HREmployeeFile />
    </ProtectedRoute>
  );
}
