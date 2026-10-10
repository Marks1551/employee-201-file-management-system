"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, Bell } from "lucide-react";
import { navConfig, type NavLinkItem } from "./navConfig";
import NotificationDrawer from "./NotificationDrawer";
import FacultyNotificationDrawer from "./FacultyNotificationDrawer";
import { useFacultyNotifications } from "@/shared/lib/useFacultyNotifications";
import { useChatUnread } from "@/features/chat/useChatUnread";
import { useApp, roleLabel } from "@/shared/context/AppContext";
import type { Role } from "@/shared/types";

interface LayoutProps {
  role: Role;
  eyebrow?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
}

export default function Layout({ role, eyebrow, title, children }: LayoutProps) {
  const [navOpen, setNavOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { currentUser, currentEmployee, logout, notifications } = useApp();
  const router = useRouter();
  const pathname = usePathname();

  const items = navConfig[role];

  // Close the notifications panel whenever the page changes.
  useEffect(() => {
    setNotifOpen(false);
  }, [pathname]);

  // HR sees the shared notification list; faculty see only their own, worked out from their 201 file.
  const facultyNotifications = useFacultyNotifications(currentEmployee, role === "faculty", notifications);
  const unreadNotificationsCount =
    role === "faculty" ? facultyNotifications.unreadCount : notifications.filter((n) => n.status === "unread").length;
  // Faculty: documents HR is waiting on (missing, or rejected and needing a resubmit).
  const documentsNeededCount =
    role === "faculty"
      ? (currentEmployee?.documents || []).filter((d) => d.status === "missing" || d.status === "rejected").length
      : 0;
  const unreadChatCount = useChatUnread(role === "hr" || role === "faculty");

  function isNavActive(item: NavLinkItem) {
    if (item.end) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  }

  function handleLogout() {
    logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile scrim */}
      <div
        className={`fixed inset-0 bg-navy-dark/45 z-[35] transition-opacity md:hidden ${navOpen ? "block" : "hidden"}`}
        onClick={() => setNavOpen(false)}
      />

      <aside
        className={`w-[248px] flex-shrink-0 bg-navy-dark text-[#EDF1F6] flex flex-col fixed top-0 left-0 bottom-0 z-40 transition-transform duration-200 ${
          navOpen ? "translate-x-0 shadow-pop" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center gap-3 px-[18px] py-5 border-b border-white/10">
          <img src="/assets/logo.png" alt="LSSTI seal" className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="leading-tight">
            <strong className="block font-display text-[0.92rem] text-white">Employee 201 File</strong>
            <span className="block text-[0.72rem] text-[#AEB9C7]">LSSTI Management System</span>
          </div>
        </div>

        <nav className="flex-1 px-2.5 py-3.5 overflow-y-auto scrollbar-thin">
          {items.map((item, i) =>
            "section" in item && item.section ? (
              <div key={i} className="text-[0.72rem] uppercase tracking-wider text-[#7C899B] px-3.5 pt-3.5 pb-1.5">
                {item.section}
              </div>
            ) : (
              (() => {
                const navItem = item as NavLinkItem;
                return (
                  <Link
                    key={navItem.to}
                    href={navItem.to}
                    onClick={() => setNavOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-[0.96rem] font-medium no-underline mb-1 transition-colors ${
                      isNavActive(navItem)
                        ? "bg-gold text-navy-dark font-semibold"
                        : "text-[#CBD5E1] hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <navItem.icon size={20} className="flex-shrink-0" />
                    <span className="flex-1">{navItem.label}</span>
                    {navItem.badgeKey === "notifications" && unreadNotificationsCount > 0 && (
                      <span className="bg-danger-bg text-danger-text border border-danger-border rounded-full text-[0.72rem] font-bold px-2 py-0.5">
                        {unreadNotificationsCount}
                      </span>
                    )}
                    {navItem.badgeKey === "documents" && documentsNeededCount > 0 && (
                      <span className="bg-danger-bg text-danger-text border border-danger-border rounded-full text-[0.72rem] font-bold px-2 py-0.5">
                        {documentsNeededCount}
                      </span>
                    )}
                    {navItem.badgeKey === "chat" && unreadChatCount > 0 && (
                      <span className="bg-danger-bg text-danger-text border border-danger-border rounded-full text-[0.72rem] font-bold px-2 py-0.5">
                        {unreadChatCount}
                      </span>
                    )}
                  </Link>
                );
              })()
            ),
          )}
        </nav>

        <div className="px-3.5 pt-3.5 pb-[18px] border-t border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 text-[#F3C6C6] no-underline font-semibold text-[0.94rem] px-3 py-2.5 rounded-lg hover:bg-[rgba(240,120,120,0.14)] w-full transition-colors"
          >
            <LogOut size={18} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 md:ml-[248px]">
        <header className="h-[72px] bg-white border-b border-border flex items-center justify-between px-4 md:px-7 sticky top-0 z-30">
          <div className="flex items-center gap-3.5">
            <button
              aria-label="Open navigation menu"
              aria-expanded={navOpen}
              onClick={() => setNavOpen((o) => !o)}
              className="md:hidden bg-transparent border-none cursor-pointer p-1.5 text-navy"
            >
              <Menu size={26} />
            </button>
            <div>
              <div className="text-[0.8rem] text-ink-faint font-medium mb-0.5">{eyebrow}</div>
              <h1 className="text-[1.3rem]">{title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="leading-tight hidden sm:block text-right">
              <strong className="block text-[0.92rem] text-ink">{currentUser?.name}</strong>
              <span className="block text-[0.78rem] text-ink-faint">
                {currentUser ? roleLabel(currentUser.role) : ""}
              </span>
            </div>
            {currentUser?.photoUrl ? (
              <img
                src={currentUser.photoUrl}
                alt={`Photo of ${currentUser.name}`}
                className="w-10 h-10 rounded-full object-cover border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-navy-100 text-navy flex items-center justify-center font-bold font-display text-[0.95rem] flex-shrink-0">
                {currentUser?.initials}
              </div>
            )}
            {(role === "hr" || role === "faculty") && (
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-haspopup="dialog"
                aria-expanded={notifOpen}
                aria-label={
                  unreadNotificationsCount > 0 ? `Notifications, ${unreadNotificationsCount} unread` : "Notifications"
                }
                title="Notifications"
                className={`relative ml-1 w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors border-none cursor-pointer ${
                  notifOpen ? "bg-gold text-navy-dark" : "bg-navy-100 text-navy hover:opacity-80"
                }`}
              >
                <Bell size={20} />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-danger-text text-white text-[0.68rem] font-bold leading-none border-2 border-white">
                    {unreadNotificationsCount > 99 ? "99+" : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </header>

        <div className="p-4 md:p-7 max-w-[1180px] w-full">{children}</div>
      </div>

      {role === "hr" && <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />}
      {role === "faculty" && (
        <FacultyNotificationDrawer
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          notifications={facultyNotifications}
        />
      )}
    </div>
  );
}
