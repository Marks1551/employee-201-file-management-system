'use client';

import Link from 'next/link';
import { AlertTriangle, Clock, CheckCheck } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { Card, Button } from '@/shared/components/ui';
import { useApp } from '@/shared/context/AppContext';

export default function Notifications() {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useApp();
  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  return (
    <Layout role="hr" eyebrow="HR › Notifications" title="Notifications">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <p className="text-ink-muted m-0">Missing-document alerts, documents awaiting review, and expiring-certificate reminders, kept in sync automatically as records change.</p>
        {unreadCount > 0 && (
          <Button variant="secondary" sm onClick={markAllNotificationsRead}>
            <CheckCheck size={16} />
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="text-center py-10 text-ink-faint">You're all caught up — no outstanding notifications.</Card>
      ) : (
        <div className="grid gap-3">
          {notifications.map((n) => {
            const isMissing = n.kind === 'missing_document';
            const unread = n.status === 'unread';
            return (
              <Link
                key={n.id}
                href={`/hr/employees/${n.employeeId}`}
                onClick={() => unread && markNotificationRead(n.id)}
                className="no-underline text-ink"
              >
                <Card
                  className={`flex gap-3.5 items-start hover:border-gold hover:shadow-pop transition-all ${unread ? '' : 'opacity-55'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isMissing ? 'bg-danger-bg text-danger-text' : 'bg-warn-bg text-warn-text'}`}>
                    {isMissing ? <AlertTriangle size={20} /> : <Clock size={20} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-0.5 text-[0.98rem] flex items-center gap-2">
                      {n.title}
                      {unread && <span className="w-2 h-2 rounded-full bg-navy inline-block" />}
                    </h3>
                    <p className="m-0 text-[0.86rem] text-ink-muted">{n.detail}</p>
                  </div>
                  <span className="text-[0.76rem] text-ink-faint whitespace-nowrap">{n.when}</span>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
