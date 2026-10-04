"use client";

import ProtectedRoute from "@/shared/components/ProtectedRoute";
import ProfilePage from "@/shared/components/ProfilePage";

export default function Page() {
  return (
    <ProtectedRoute role="admin">
      <ProfilePage role="admin" />
    </ProtectedRoute>
  );
}
