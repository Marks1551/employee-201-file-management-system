"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, CheckCheck, X, BellOff, Trash2, XCircle, Megaphone } from "lucide-react";
import type { FacultyNotificationsApi } from "@/shared/lib/useFacultyNotifications";

interface Props {
  open: boolean;
  onClose: () => void;
  notifications: FacultyNotificationsApi;
}

/** Slide-in side panel (from the right) listing the faculty member's own notifications. */
export default function FacultyNotificationDrawer({ open, onClose, notifications }: Props) {
  const { items, unreadCount, markRead, markAllRead, dismiss, dismissAll } = notifications;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-navy-dark/45 z-[55] transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="Notifications"
        aria-hidden={!open}
        className={`fixed top-0 right-0 bottom-0 w-full max-w-[400px] bg-white z-[60] flex flex-col shadow-pop transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 h-[72px] border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-[1.15rem] m-0">Notifications</h2>
            <span className="text-[0.78rem] text-ink-faint">
              {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer text-navy hover:bg-navy-100"
          >
            <X size={22} />
          </button>
        </div>

        {items.length > 0 && (
          <div className="px-5 py-3 border-b border-border flex-shrink-0 flex items-center justify-between gap-3 flex-wrap">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1.5 text-navy font-semibold text-[0.86rem] bg-transparent border-none cursor-pointer p-0 hover:underline"
              >
                <CheckCheck size={16} />
                Mark all as read
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => window.confirm("Delete all notifications?") && dismissAll()}
              className="inline-flex items-center gap-1.5 text-danger-text font-semibold text-[0.86rem] bg-transparent border-none cursor-pointer p-0 hover:underline"
            >
              <Trash2 size={15} />
              Delete all
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin p-3">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-ink-faint gap-2 px-6">
              <BellOff size={32} />
              <p className="m-0">You&apos;re all caught up — no outstanding notifications.</p>
            </div>
          ) : (
            <ul className="list-none m-0 p-0 grid gap-2">
              {items.map((n) => (
                <li key={n.id} className="relative">
                  <Link
                    href={n.href}
                    onClick={() => {
                      markRead(n.id);
                      onClose();
                    }}
                    className={`flex gap-3 items-start p-3 pr-11 rounded-xl border border-border no-underline text-ink hover:border-gold hover:shadow-pop transition-all ${
                      n.unread ? "bg-navy-100/50" : "opacity-60"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        n.kind === "missing" || n.kind === "rejected"
                          ? "bg-danger-bg text-danger-text"
                          : n.kind === "announcement"
                            ? "bg-navy-100 text-navy"
                            : "bg-warn-bg text-warn-text"
                      }`}
                    >
                      {n.kind === "missing" ? (
                        <AlertTriangle size={18} />
                      ) : n.kind === "rejected" ? (
                        <XCircle size={18} />
                      ) : n.kind === "announcement" ? (
                        <Megaphone size={18} />
                      ) : (
                        <Clock size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="mb-0.5 text-[0.92rem] leading-snug break-words whitespace-normal">
                        {n.title}
                        {n.unread && <span className="w-2 h-2 rounded-full bg-navy inline-block ml-2 align-middle" />}
                      </h3>
                      <p className="m-0 text-[0.82rem] leading-snug text-ink-muted break-words whitespace-normal">
                        {n.detail}
                      </p>
                      {n.when && <span className="block mt-1 text-[0.74rem] text-ink-faint">{n.when}</span>}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => dismiss(n.id)}
                    aria-label={`Delete notification: ${n.title}`}
                    title="Delete"
                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer text-ink-faint hover:bg-danger-bg hover:text-danger-text"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
