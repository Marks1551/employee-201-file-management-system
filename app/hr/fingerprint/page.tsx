'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import FingerprintSetupPage from '@/shared/components/FingerprintSetupPage';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <FingerprintSetupPage role="hr" />
    </ProtectedRoute>
  );
}
