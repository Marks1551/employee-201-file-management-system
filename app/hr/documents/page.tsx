'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import DocumentManagement from '@/features/employees/components/DocumentManagement';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <DocumentManagement />
    </ProtectedRoute>
  );
}
