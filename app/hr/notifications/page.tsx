'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import Notifications from '@/features/notifications/components/Notifications';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <Notifications />
    </ProtectedRoute>
  );
}
