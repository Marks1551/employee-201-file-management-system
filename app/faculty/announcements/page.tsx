"use client";

import ProtectedRoute from "@/shared/components/ProtectedRoute";
import Announcements from "@/features/announcements/components/Announcements";

export default function Page() {
  return (
    <ProtectedRoute role="faculty">
      <Announcements role="faculty" />
    </ProtectedRoute>
  );
}
