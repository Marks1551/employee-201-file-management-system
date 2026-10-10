"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Send, Trash2 } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Button, Card, Field, inputCls, Tag } from "@/shared/components/ui";
import { useToast } from "@/shared/context/ToastContext";
import { DEPARTMENTS } from "@/shared/lib/roles";
import type { Announcement } from "@/features/announcements/server/service";

/** HR: write and manage announcements. Faculty: read the ones addressed to them. */
export default function Announcements({ role }: { role: "hr" | "faculty" }) {
  const showToast = useToast();
  const isHr = role === "hr";
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = await res.json();
      setItems(res.ok ? data.announcements : []);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePost() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, department: audience === "all" ? undefined : audience }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not post the announcement.");
      showToast(`Announcement sent to ${audience === "all" ? "all employees" : audience}.`);
      setTitle("");
      setBody("");
      setAudience("all");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not post the announcement.", "error");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(a: Announcement) {
    if (!window.confirm(`Delete the announcement "${a.title}"? Employees will no longer see it.`)) return;
    const res = await fetch(`/api/announcements/${encodeURIComponent(a.id)}`, { method: "DELETE" });
    if (!res.ok) {
      showToast("Could not delete the announcement.", "error");
      return;
    }
    showToast("Announcement deleted.");
    await load();
  }

  return (
    <Layout role={role} eyebrow={isHr ? "HR › Announcements" : "Faculty"} title="Announcements">
      {isHr && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Megaphone size={18} className="text-navy" />
            <h3 className="m-0 text-[1.05rem]">New announcement</h3>
          </div>
          <p className="text-[0.86rem] text-ink-muted mb-4">
            Employees are notified right away — it shows in their notification bell and on their Announcements page.
          </p>
          <div className="grid gap-4">
            <Field label="Title" htmlFor="annTitle">
              <input
                id="annTitle"
                className={inputCls}
                maxLength={200}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Submit your updated PDS by Friday"
              />
            </Field>
            <Field label="Message" htmlFor="annBody">
              <textarea
                id="annBody"
                className={`${inputCls} min-h-[120px] py-3`}
                maxLength={5000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </Field>
            <Field label="Send to" htmlFor="annAudience">
              <select
                id="annAudience"
                className={inputCls}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              >
                <option value="all">All employees</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d} only
                  </option>
                ))}
              </select>
            </Field>
            <div>
              <Button onClick={handlePost} disabled={sending || !title.trim() || !body.trim()}>
                <Send size={16} />
                {sending ? "Sending…" : "Send Announcement"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <h3 className="mb-3 text-[1.05rem]">{isHr ? "Posted announcements" : "Latest announcements"}</h3>
      {items === null ? (
        <p className="text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <p className="m-0 text-ink-muted">
            {isHr ? "You haven't posted any announcements yet." : "No announcements right now."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {items.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 className="m-0 mb-1 text-[1rem] break-words">{a.title}</h4>
                  <div className="flex items-center gap-2 flex-wrap text-[0.78rem] text-ink-faint mb-2">
                    <Tag kind={a.audience === "all" ? "ok" : "warn"}>
                      {a.audience === "all" ? "Everyone" : a.audience}
                    </Tag>
                    <span>
                      {a.createdBy} · {a.when}
                    </span>
                  </div>
                  <p className="m-0 text-[0.92rem] whitespace-pre-wrap break-words">{a.body}</p>
                </div>
                {isHr && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a)}
                    aria-label={`Delete announcement ${a.title}`}
                    title="Delete"
                    className="w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center bg-transparent border-none cursor-pointer text-ink-faint hover:bg-danger-bg hover:text-danger-text"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Layout>
  );
}
