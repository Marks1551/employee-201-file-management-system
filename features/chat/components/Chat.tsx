"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Search, MessageSquare, Loader2, Paperclip, X, FileText } from "lucide-react";
import Layout from "@/shared/components/Layout";
import { Card, Avatar } from "@/shared/components/ui";
import type { Role } from "@/shared/types";

interface Contact {
  id: string;
  name: string;
  initials: string;
  photoUrl: string | null;
  role: Role;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  unread: number;
}

interface Attachment {
  url: string;
  name: string;
  type: string;
  size: number | null;
}

interface Message {
  id: string;
  body: string;
  attachment: Attachment | null;
  mine: boolean;
  read: boolean;
  when: string;
}

const MAX_LEN = 2000;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB — must match the server limit
const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "txt",
  "csv",
];
const FILE_ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif"];

function extensionOf(name: string): string {
  return (name.split(".").pop() || "").toLowerCase();
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Chat({ role }: { role: "hr" | "faculty" }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  // Which conversation `messages` belongs to — until it matches the open one, we show a loader instead of "No messages yet".
  const [messagesFor, setMessagesFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const partnerLabel = role === "hr" ? "faculty member" : "HR staff";
  const active = contacts.find((c) => c.id === activeId) || null;
  const loadingThread = activeId !== null && messagesFor !== activeId;

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      setContacts(data.contacts);
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/chat/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load messages.");
        if (activeIdRef.current === id) setMessagesFor(id);
        return;
      }
      if (activeIdRef.current === id) {
        setMessages(data.messages);
        setMessagesFor(id);
      }
    } catch {
      // transient network error — next poll will retry
    }
  }, []);

  // contact list: initial load + poll
  useEffect(() => {
    loadContacts();
    const t = setInterval(loadContacts, 8000);
    return () => clearInterval(t);
  }, [loadContacts]);

  // active conversation: load + poll
  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    setError("");
    setFile(null); // never carry an attachment over to a different person
    loadMessages(activeId);
    const t = setInterval(() => loadMessages(activeId), 4000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, activeId]);

  // Thumbnail for a photo that's been picked but not sent yet.
  useEffect(() => {
    if (!file || !IMAGE_EXTENSIONS.includes(extensionOf(file.name))) {
      setFilePreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  /** Validates a picked/pasted file and stages it for sending. */
  function stageFile(picked: File | null | undefined) {
    if (!picked) return;
    if (!ALLOWED_EXTENSIONS.includes(extensionOf(picked.name))) {
      setError(
        "That file type isn't allowed. You can send photos (JPG, PNG, WEBP, GIF), PDF, Word, Excel, PowerPoint, TXT or CSV.",
      );
      return;
    }
    if (picked.size > MAX_FILE_SIZE) {
      setError("File must be smaller than 5MB.");
      return;
    }
    setError("");
    setFile(picked);
  }

  async function handleSend() {
    const body = draft.trim();
    if ((!body && !file) || !activeId || sending) return;
    setSending(true);
    setError("");
    try {
      let res: Response;
      if (file) {
        // Photo/file (with optional caption) goes as multipart; the browser sets the boundary header itself.
        const form = new FormData();
        form.append("body", body);
        form.append("file", file);
        res = await fetch(`/api/chat/${activeId}`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/chat/${activeId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Message could not be sent.");
      setMessages(data.messages);
      setMessagesFor(activeId);
      setDraft("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Layout
      role={role}
      eyebrow={role === "hr" ? "HR › Chat" : "Faculty › Chat"}
      title={role === "hr" ? "Chat with Faculty" : "Chat with HR"}
    >
      <Card className="p-0 overflow-hidden flex h-[calc(100vh-190px)] min-h-[460px]">
        {/* Contact list */}
        <div
          className={`${activeId ? "hidden md:flex" : "flex"} flex-col w-full md:w-[300px] md:border-r border-border flex-shrink-0`}
        >
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${partnerLabel}…`}
                className="w-full min-h-[40px] pl-9 pr-3 rounded-lg border border-border-strong text-[0.9rem] bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {loadingContacts ? (
              <p className="p-4 text-ink-faint text-[0.9rem] m-0">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-ink-faint text-[0.9rem] m-0">
                {contacts.length === 0 ? `No ${partnerLabel} accounts available yet.` : "No matches."}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-3 border-b border-border cursor-pointer transition-colors ${
                    c.id === activeId ? "bg-navy-100" : "bg-white hover:bg-cream"
                  }`}
                >
                  <Avatar photoUrl={c.photoUrl} initials={c.initials} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[0.92rem] text-ink truncate">{c.name}</strong>
                      {c.lastMessageAt && (
                        <span className="text-[0.7rem] text-ink-faint whitespace-nowrap">{c.lastMessageAt}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[0.82rem] truncate ${c.unread ? "text-ink font-semibold" : "text-ink-muted"}`}
                      >
                        {c.lastMessage ? `${c.lastMessageMine ? "You: " : ""}${c.lastMessage}` : "No messages yet"}
                      </span>
                      {c.unread > 0 && (
                        <span className="bg-navy text-white rounded-full text-[0.7rem] font-bold px-1.5 min-w-[20px] text-center">
                          {c.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={`${activeId ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-ink-faint gap-2 p-6 text-center">
              <MessageSquare size={36} />
              <p className="m-0">Select a {partnerLabel} to start chatting.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <button
                  aria-label="Back to contacts"
                  onClick={() => setActiveId(null)}
                  className="md:hidden bg-transparent border-none cursor-pointer text-navy p-1"
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar photoUrl={active.photoUrl} initials={active.initials} size="sm" />
                <div className="leading-tight">
                  <strong className="block text-[0.95rem]">{active.name}</strong>
                  <span className="text-[0.76rem] text-ink-faint">
                    {active.role === "hr" ? "HR Personnel" : "Faculty"}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 bg-cream/50 space-y-2.5">
                {loadingThread ? (
                  <div role="status" className="h-full flex flex-col items-center justify-center gap-2 text-ink-faint">
                    <Loader2 size={26} className="animate-spin text-navy" />
                    <p className="m-0 text-[0.9rem]">Loading messages…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-ink-faint text-[0.9rem] mt-8">No messages yet. Say hello 👋</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.92rem] shadow-card ${
                          m.mine
                            ? "bg-navy text-white rounded-br-sm"
                            : "bg-white text-ink border border-border rounded-bl-sm"
                        }`}
                      >
                        {m.attachment &&
                          (m.attachment.type.startsWith("image/") ? (
                            <a href={m.attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={m.attachment.url}
                                alt={m.attachment.name}
                                loading="lazy"
                                className={`rounded-lg max-h-64 max-w-full object-cover ${m.body ? "mb-2" : ""}`}
                              />
                            </a>
                          ) : (
                            <a
                              href={m.attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 no-underline ${m.body ? "mb-2" : ""} ${
                                m.mine
                                  ? "bg-white/15 text-white hover:bg-white/25"
                                  : "bg-cream text-ink hover:bg-navy-100"
                              }`}
                            >
                              <FileText size={22} className="flex-shrink-0" />
                              <span className="min-w-0">
                                <span className="block font-semibold text-[0.86rem] truncate">{m.attachment.name}</span>
                                <span className={`block text-[0.72rem] ${m.mine ? "text-white/70" : "text-ink-faint"}`}>
                                  {formatSize(m.attachment.size)}
                                  {m.attachment.size ? " · " : ""}Tap to open
                                </span>
                              </span>
                            </a>
                          ))}
                        {m.body && <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>}
                        <span
                          className={`block text-[0.68rem] mt-1 text-right ${m.mine ? "text-white/70" : "text-ink-faint"}`}
                        >
                          {m.when}
                          {m.mine && (m.read ? " · Seen" : "")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {error && (
                <div className="px-4 py-2 text-[0.84rem] bg-danger-bg text-danger-text border-t border-danger-border">
                  {error}
                </div>
              )}

              {file && (
                <div className="flex items-center gap-3 px-3 pt-3 bg-white border-t border-border">
                  <div className="flex items-center gap-3 min-w-0 bg-cream rounded-lg px-3 py-2 border border-border">
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Selected photo"
                        className="w-12 h-12 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <FileText size={24} className="text-navy flex-shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block text-[0.86rem] font-semibold truncate max-w-[220px]">{file.name}</span>
                      <span className="block text-[0.72rem] text-ink-faint">{formatSize(file.size)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      aria-label="Remove attachment"
                      className="bg-transparent border-none cursor-pointer text-ink-faint hover:text-danger-text p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              <div className={`flex items-end gap-2 p-3 bg-white ${file ? "" : "border-t border-border"}`}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={FILE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    stageFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach a photo or file"
                  title="Attach a photo or file"
                  className="min-h-[46px] w-[46px] rounded-lg border border-border-strong bg-white text-navy flex items-center justify-center cursor-pointer hover:bg-navy-100 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Paperclip size={18} />
                </button>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  onPaste={(e) => {
                    // Pasting a screenshot/photo attaches it.
                    const pasted = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
                    if (pasted) {
                      e.preventDefault();
                      const ext = pasted.type.split("/")[1] || "png";
                      stageFile(
                        new File(
                          [pasted],
                          pasted.name && pasted.name !== "image.png"
                            ? pasted.name
                            : `pasted-image.${ext === "jpeg" ? "jpg" : ext}`,
                          { type: pasted.type },
                        ),
                      );
                    }
                  }}
                  rows={1}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none max-h-32 min-h-[46px] px-3.5 py-3 rounded-lg border border-border-strong text-[0.92rem] bg-white"
                />
                <button
                  onClick={handleSend}
                  disabled={(!draft.trim() && !file) || sending}
                  aria-label="Send message"
                  className="min-h-[46px] w-[46px] rounded-lg bg-navy text-white flex items-center justify-center cursor-pointer hover:bg-navy-dark disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      </Card>
    </Layout>
  );
}
