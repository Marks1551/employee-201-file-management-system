"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Employee, Notification } from "@/shared/types";

export type FacultyNotificationKind = "missing" | "rejected" | "pending" | "expiring" | "announcement";

/** The bits of an announcement the bell needs. */
export interface AnnouncementAlert {
  id: string;
  title: string;
  body: string;
  when: string | null;
}

export interface FacultyNotification {
  id: string;
  kind: FacultyNotificationKind;
  title: string;
  detail: string;
  when: string | null;
  href: string;
  unread: boolean;
}

interface Stored {
  read: string[];
  dismissed: string[];
}

const storageKey = (employeeId: string) => `faculty-notifications:${employeeId}`;

function load(employeeId: string): Stored {
  try {
    const raw = window.localStorage.getItem(storageKey(employeeId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return { read: parsed.read || [], dismissed: parsed.dismissed || [] };
    }
  } catch {
    /* storage unavailable — start fresh */
  }
  return { read: [], dismissed: [] };
}

/**
 * Faculty notifications are worked out from the employee's own 201 file — documents HR is
 * asking for, rejected or pending submissions, and expiring certificates — so a faculty member
 * only ever sees their own items. Whether one has been read or deleted is remembered in this
 * browser. An item's id includes its status/timestamp, so the same document being rejected (or
 * requested) again shows up as a fresh notification.
 */
export function useFacultyNotifications(
  employee: Employee | null,
  enabled: boolean,
  alerts: Notification[] = [],
  announcements: AnnouncementAlert[] = [],
) {
  const employeeId = employee?.id || "";
  const [stored, setStored] = useState<Stored>({ read: [], dismissed: [] });

  useEffect(() => {
    if (enabled && employeeId) setStored(load(employeeId));
  }, [enabled, employeeId]);

  const save = useCallback(
    (next: Stored) => {
      setStored(next);
      try {
        window.localStorage.setItem(storageKey(employeeId), JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [employeeId],
  );

  const all = useMemo(() => {
    if (!enabled || !employee) return [] as Omit<FacultyNotification, "unread">[];
    const list: Omit<FacultyNotification, "unread">[] = [];
    // When each alert first came up (date and time), from the server's own record of it.
    const docTime = new Map(alerts.filter((a) => a.documentId).map((a) => [a.documentId as string, a.when]));
    const trainingTime = new Map(alerts.filter((a) => a.trainingId).map((a) => [a.trainingId as string, a.when]));
    for (const d of employee.documents) {
      if (d.status === "missing") {
        list.push({
          id: `missing:${d.id}`,
          kind: "missing",
          title: `HR is asking for: ${d.name}`,
          detail: "Please upload this document under Submit a Document.",
          when: docTime.get(d.id) || null,
          href: "/faculty/submit",
        });
      } else if (d.status === "rejected") {
        list.push({
          id: `rejected:${d.id}:${d.reviewedAt || ""}`,
          kind: "rejected",
          title: `${d.name} was rejected`,
          detail: d.reviewNote ? `HR note: ${d.reviewNote}` : "Please fix it and submit again.",
          when: d.reviewedAt,
          href: "/faculty/submit",
        });
      } else if (d.status === "pending") {
        list.push({
          id: `pending:${d.id}:${d.submitted || ""}`,
          kind: "pending",
          title: `${d.name} is awaiting HR review`,
          detail: "HR has your submission and will approve or reject it.",
          when: d.submitted,
          href: "/faculty/201file",
        });
      }
    }
    for (const t of employee.training) {
      if (t.certStatus === "expiring") {
        list.push({
          id: `expiring:${t.id}`,
          kind: "expiring",
          title: `${t.course} certificate expiring soon`,
          detail: "Upload a renewed certificate to keep your 201 file up to date.",
          when: trainingTime.get(t.id) || null,
          href: "/faculty/201file",
        });
      }
    }
    for (const a of announcements) {
      list.push({
        id: `announcement:${a.id}`,
        kind: "announcement",
        title: a.title,
        detail: a.body.length > 140 ? `${a.body.slice(0, 140).trimEnd()}…` : a.body,
        when: a.when,
        href: "/faculty/announcements",
      });
    }
    return list;
  }, [enabled, employee, alerts, announcements]);

  const items: FacultyNotification[] = useMemo(
    () =>
      all
        .filter((n) => !stored.dismissed.includes(n.id))
        .map((n) => ({ ...n, unread: !stored.read.includes(n.id) }))
        // unread first, then the ones that need action before the purely informational ones
        .sort(
          (a, b) => Number(b.unread) - Number(a.unread) || Number(a.kind === "pending") - Number(b.kind === "pending"),
        ),
    [all, stored],
  );

  const unreadCount = items.filter((n) => n.unread).length;

  return {
    items,
    unreadCount,
    markRead: (id: string) => {
      if (!stored.read.includes(id)) save({ ...stored, read: [...stored.read, id] });
    },
    markAllRead: () => save({ ...stored, read: Array.from(new Set([...stored.read, ...items.map((n) => n.id)])) }),
    dismiss: (id: string) => save({ ...stored, dismissed: [...stored.dismissed, id] }),
    dismissAll: () =>
      save({ ...stored, dismissed: Array.from(new Set([...stored.dismissed, ...items.map((n) => n.id)])) }),
  };
}

export type FacultyNotificationsApi = ReturnType<typeof useFacultyNotifications>;
