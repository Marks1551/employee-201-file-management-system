'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import FacultyDashboard from '@/features/dashboard/components/FacultyDashboard';

export default function Page() {
  return (
    <ProtectedRoute role="faculty">
      <FacultyDashboard />
    </ProtectedRoute>
  );
}
