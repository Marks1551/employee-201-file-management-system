'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import HRDashboard from '@/features/dashboard/components/HRDashboard';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <HRDashboard />
    </ProtectedRoute>
  );
}
