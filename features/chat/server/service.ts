import { randomUUID } from "crypto";
import { query, execute } from "@/shared/server/db";
import { fmt } from "@/shared/server/format";
import { ensurePhotoColumn } from "@/features/users/server/service";
import type { Role } from "@/shared/types";

export interface ChatContact {
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

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  mine: boolean;
  read: boolean;
  when: string;
}

export const MAX_MESSAGE_LENGTH = 2000;

/** Chat is HR <-> Faculty only. Returns the role a given role may talk to. */
export function chatPartnerRole(role: string): Role | null {
  if (role === "hr") return "faculty";
  if (role === "faculty") return "hr";
  return null;
}

/** Active users the given user is allowed to chat with, with last message + unread count. */
export async function listContacts(me: { id: string; role: string }): Promise<ChatContact[]> {
  const partnerRole = chatPartnerRole(me.role);
  if (!partnerRole) return [];

  await ensurePhotoColumn();
  const rows = await query<{
    id: string;
    name: string;
    initials: string | null;
    photo_url: string | null;
    role: Role;
    last_body: string | null;
    last_at: string | null;
    last_sender: string | null;
    unread: number | string;
  }>(
    `SELECT u.id, u.name, u.initials, u.role, COALESCE(u.photo_url, e.photo_url) AS photo_url,
            (SELECT m.body FROM messages m
              WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
              ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_body,
            (SELECT m.created_at FROM messages m
              WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
              ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
            (SELECT m.sender_id FROM messages m
              WHERE (m.sender_id = u.id AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = u.id)
              ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_sender,
            (SELECT COUNT(*) FROM messages m
              WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL) AS unread
       FROM users u
       LEFT JOIN employees e ON e.id = u.employee_id
      WHERE u.role = ? AND u.status = 'active' AND u.id <> ?
      ORDER BY (last_at IS NULL), last_at DESC, u.name ASC`,
    [me.id, me.id, me.id, me.id, me.id, me.id, me.id, partnerRole, me.id],
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    initials: r.initials || r.name.slice(0, 2).toUpperCase(),
    photoUrl: r.photo_url || null,
    role: r.role,
    lastMessage: r.last_body,
    lastMessageAt: r.last_at ? fmt(r.last_at) : null,
    lastMessageMine: r.last_sender === me.id,
    unread: Number(r.unread) || 0,
  }));
}

/** Returns the other user's role+status if `me` is allowed to chat with them, else null. */
export async function getAllowedPartner(
  me: { id: string; role: string },
  otherId: string,
): Promise<{ id: string; name: string; role: Role } | null> {
  const partnerRole = chatPartnerRole(me.role);
  if (!partnerRole || otherId === me.id) return null;
  const rows = await query<{ id: string; name: string; role: Role }>(
    "SELECT id, name, role FROM users WHERE id = ? AND role = ? AND status = 'active'",
    [otherId, partnerRole],
  );
  return rows[0] || null;
}

export async function getConversation(meId: string, otherId: string, afterId?: string | null): Promise<ChatMessage[]> {
  const rows = await query<{
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, sender_id, recipient_id, body, read_at, created_at FROM (
       SELECT * FROM messages
        WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
        ORDER BY created_at DESC, id DESC LIMIT 300
     ) t ORDER BY created_at ASC, id ASC`,
    [meId, otherId, otherId, meId],
  );
  return rows.map((r) => ({
    id: r.id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    mine: r.sender_id === meId,
    read: !!r.read_at,
    when: fmt(r.created_at) || "",
  }));
}

export async function markConversationRead(meId: string, otherId: string): Promise<void> {
  await execute(
    "UPDATE messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL",
    [otherId, meId],
  );
}

export async function sendMessage(senderId: string, recipientId: string, body: string): Promise<void> {
  await execute("INSERT INTO messages (id, sender_id, recipient_id, body) VALUES (?,?,?,?)", [
    `msg-${randomUUID()}`,
    senderId,
    recipientId,
    body,
  ]);
}

export async function countUnread(meId: string): Promise<number> {
  const rows = await query<{ c: number | string }>(
    "SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL",
    [meId],
  );
  return Number(rows[0]?.c) || 0;
}
