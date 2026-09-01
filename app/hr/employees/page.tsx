'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import HREmployees from '@/features/employees/components/EmployeeList';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <HREmployees />
    </ProtectedRoute>
  );
}
