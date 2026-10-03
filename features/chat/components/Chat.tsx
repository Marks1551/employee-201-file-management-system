'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send, Search, MessageSquare } from 'lucide-react';
import Layout from '@/shared/components/Layout';
import { Card } from '@/shared/components/ui';
import type { Role } from '@/shared/types';

interface Contact {
  id: string;
  name: string;
  initials: string;
  role: Role;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageMine: boolean;
  unread: number;
}

interface Message {
  id: string;
  body: string;
  mine: boolean;
  read: boolean;
  when: string;
}

const MAX_LEN = 2000;

export default function Chat({ role }: { role: 'hr' | 'faculty' }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeId;

  const partnerLabel = role === 'hr' ? 'faculty member' : 'HR staff';
  const active = contacts.find((c) => c.id === activeId) || null;

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/chat');
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
        setError(data.error || 'Could not load messages.');
        return;
      }
      if (activeIdRef.current === id) setMessages(data.messages);
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
    setError('');
    loadMessages(activeId);
    const t = setInterval(() => loadMessages(activeId), 4000);
    return () => clearInterval(t);
  }, [activeId, loadMessages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeId]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/chat/${activeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Message could not be sent.');
      setMessages(data.messages);
      setDraft('');
      loadContacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.');
    } finally {
      setSending(false);
    }
  }

  const filtered = contacts.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Layout
      role={role}
      eyebrow={role === 'hr' ? 'HR › Chat' : 'Faculty › Chat'}
      title={role === 'hr' ? 'Chat with Faculty' : 'Chat with HR'}
    >
      <Card className="p-0 overflow-hidden flex h-[calc(100vh-190px)] min-h-[460px]">
        {/* Contact list */}
        <div className={`${activeId ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-[300px] md:border-r border-border flex-shrink-0`}>
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
                {contacts.length === 0 ? `No ${partnerLabel} accounts available yet.` : 'No matches.'}
              </p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-3 border-b border-border cursor-pointer transition-colors ${
                    c.id === activeId ? 'bg-navy-100' : 'bg-white hover:bg-cream'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-navy-100 text-navy flex items-center justify-center font-bold font-display text-[0.85rem] flex-shrink-0">
                    {c.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-[0.92rem] text-ink truncate">{c.name}</strong>
                      {c.lastMessageAt && <span className="text-[0.7rem] text-ink-faint whitespace-nowrap">{c.lastMessageAt}</span>}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[0.82rem] truncate ${c.unread ? 'text-ink font-semibold' : 'text-ink-muted'}`}>
                        {c.lastMessage ? `${c.lastMessageMine ? 'You: ' : ''}${c.lastMessage}` : 'No messages yet'}
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
        <div className={`${activeId ? 'flex' : 'hidden md:flex'} flex-col flex-1 min-w-0`}>
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
                <div className="w-9 h-9 rounded-full bg-navy-100 text-navy flex items-center justify-center font-bold font-display text-[0.8rem]">
                  {active.initials}
                </div>
                <div className="leading-tight">
                  <strong className="block text-[0.95rem]">{active.name}</strong>
                  <span className="text-[0.76rem] text-ink-faint">{active.role === 'hr' ? 'HR Personnel' : 'Faculty'}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 bg-cream/50 space-y-2.5">
                {messages.length === 0 ? (
                  <p className="text-center text-ink-faint text-[0.9rem] mt-8">No messages yet. Say hello 👋</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[0.92rem] shadow-card ${
                          m.mine ? 'bg-navy text-white rounded-br-sm' : 'bg-white text-ink border border-border rounded-bl-sm'
                        }`}
                      >
                        <p className="m-0 whitespace-pre-wrap break-words">{m.body}</p>
                        <span className={`block text-[0.68rem] mt-1 text-right ${m.mine ? 'text-white/70' : 'text-ink-faint'}`}>
                          {m.when}
                          {m.mine && (m.read ? ' · Seen' : '')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {error && <div className="px-4 py-2 text-[0.84rem] bg-danger-bg text-danger-text border-t border-danger-border">{error}</div>}

              <div className="flex items-end gap-2 p-3 border-t border-border bg-white">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={1}
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="flex-1 resize-none max-h-32 min-h-[46px] px-3.5 py-3 rounded-lg border border-border-strong text-[0.92rem] bg-white"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
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
