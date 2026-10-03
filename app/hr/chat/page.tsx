'use client';

import ProtectedRoute from '@/shared/components/ProtectedRoute';
import Chat from '@/features/chat/components/Chat';

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <Chat role="hr" />
    </ProtectedRoute>
  );
}
