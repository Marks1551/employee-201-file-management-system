'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import SearchRecords from '@/features/employees/components/SearchRecords';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <SearchRecords />
    </ProtectedRoute>
  );
}
