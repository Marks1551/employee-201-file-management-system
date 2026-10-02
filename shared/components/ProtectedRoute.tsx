"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useApp, roleHome } from "@/shared/context/AppContext";
import type { Role } from "@/shared/types";
import LoadingScreen from "@/shared/components/LoadingScreen";

interface ProtectedRouteProps {
  role: Role;
  children?: ReactNode;
}

export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const { currentUser, ready, loading } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!currentUser) {
      router.replace("/");
    } else if (currentUser.role !== role) {
      router.replace(roleHome(currentUser.role));
    }
  }, [ready, currentUser, role, router]);

  if (!ready || loading) return <LoadingScreen />;
  if (!currentUser || currentUser.role !== role) return null;
  return children;
}
