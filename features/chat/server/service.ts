import { randomUUID } from "crypto";
import { query, execute } from "@/shared/server/db";
import { fmt } from "@/shared/server/format";
import { ensurePhotoColumn } from "@/features/users/server/service";
import type { SavedAttachment } from "@/features/chat/server/attachments";
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

export interface ChatAttachment {
  url: string;
  name: string;
  type: string;
  size: number | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  attachment: ChatAttachment | null;
  mine: boolean;
  read: boolean;
  when: string;
}

export const MAX_MESSAGE_LENGTH = 2000;

/** Older databases don't have the attachment columns on `messages` yet — add them once, automatically. */
let attachmentColumnsReady: Promise<void> | null = null;
function ensureAttachmentColumns(): Promise<void> {
  if (!attachmentColumnsReady) {
    attachmentColumnsReady = (async () => {
      try {
        const rows = await query<{ COLUMN_NAME: string }>(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' AND COLUMN_NAME = 'attachment_url'",
        );
        if (rows.length === 0) {
          await execute(
            `ALTER TABLE messages
               ADD COLUMN attachment_url VARCHAR(500) NULL AFTER body,
               ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment_url,
               ADD COLUMN attachment_type VARCHAR(100) NULL AFTER attachment_name,
               ADD COLUMN attachment_size INT NULL AFTER attachment_type`,
          );
        }
      } catch (err) {
        console.error("ensureAttachmentColumns failed:", err);
        attachmentColumnsReady = null;
      }
    })();
  }
  return attachmentColumnsReady;
}

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
  await ensureAttachmentColumns();
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
            (SELECT CASE WHEN m.body <> '' THEN m.body
                         WHEN m.attachment_type LIKE 'image/%' THEN 'Sent a photo'
                         ELSE CONCAT('Sent a file: ', m.attachment_name) END
               FROM messages m
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
  await ensureAttachmentColumns();
  const rows = await query<{
    id: string;
    sender_id: string;
    recipient_id: string;
    body: string;
    attachment_url: string | null;
    attachment_name: string | null;
    attachment_type: string | null;
    attachment_size: number | string | null;
    read_at: string | null;
    created_at: string;
  }>(
    `SELECT id, sender_id, recipient_id, body, attachment_url, attachment_name, attachment_type, attachment_size, read_at, created_at FROM (
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
    attachment: r.attachment_url
      ? {
          url: r.attachment_url,
          name: r.attachment_name || "file",
          type: r.attachment_type || "application/octet-stream",
          size: r.attachment_size === null ? null : Number(r.attachment_size),
        }
      : null,
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

export async function sendMessage(
  senderId: string,
  recipientId: string,
  body: string,
  attachment?: SavedAttachment | null,
): Promise<void> {
  await ensureAttachmentColumns();
  await execute(
    "INSERT INTO messages (id, sender_id, recipient_id, body, attachment_url, attachment_name, attachment_type, attachment_size) VALUES (?,?,?,?,?,?,?,?)",
    [
      `msg-${randomUUID()}`,
      senderId,
      recipientId,
      body,
      attachment?.url ?? null,
      attachment?.name ?? null,
      attachment?.type ?? null,
      attachment?.size ?? null,
    ] as any[],
  );
}

export async function countUnread(meId: string): Promise<number> {
  const rows = await query<{ c: number | string }>(
    "SELECT COUNT(*) AS c FROM messages WHERE recipient_id = ? AND read_at IS NULL",
    [meId],
  );
  return Number(rows[0]?.c) || 0;
}
