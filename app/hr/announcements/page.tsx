"use client";

import ProtectedRoute from "@/shared/components/ProtectedRoute";
import Announcements from "@/features/announcements/components/Announcements";

export default function Page() {
  return (
    <ProtectedRoute role="hr">
      <Announcements role="hr" />
    </ProtectedRoute>
  );
}
