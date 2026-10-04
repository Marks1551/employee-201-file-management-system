import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import {
  getAllowedPartner,
  getConversation,
  markConversationRead,
  sendMessage,
  MAX_MESSAGE_LENGTH,
} from "@/features/chat/server/service";
import { saveChatAttachment, ALLOWED_ATTACHMENT_LABEL, type SavedAttachment } from "@/features/chat/server/attachments";

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "faculty");
  if (user instanceof NextResponse) return user;

  const { userId } = await params;
  const partner = await getAllowedPartner(user, userId);
  if (!partner) return NextResponse.json({ error: "You can only chat between HR and Faculty." }, { status: 403 });

  await markConversationRead(user.id, partner.id);
  const messages = await getConversation(user.id, partner.id);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("hr", "faculty");
  if (user instanceof NextResponse) return user;

  const { userId } = await params;
  const partner = await getAllowedPartner(user, userId);
  if (!partner) return NextResponse.json({ error: "You can only chat between HR and Faculty." }, { status: 403 });

  // Text-only messages arrive as JSON; messages with a photo/file arrive as multipart/form-data
  // (fields: `body` — optional text, `file` — the attachment).
  let body = "";
  let file: File | null = null;
  if ((request.headers.get("content-type") || "").includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Could not read the upload. Please try again." }, { status: 400 });
    const text = form.get("body");
    body = typeof text === "string" ? text.trim() : "";
    const f = form.get("file");
    if (f instanceof File && f.size > 0) file = f;
  } else {
    const data = await request.json().catch(() => ({}));
    body = typeof data.body === "string" ? data.body.trim() : "";
  }

  if (!body && !file) return NextResponse.json({ error: "Type a message or attach a file." }, { status: 400 });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 });
  }

  let attachment: SavedAttachment | null = null;
  if (file) {
    try {
      const saved = await saveChatAttachment(file);
      if ("error" in saved) return NextResponse.json({ error: saved.error }, { status: 400 });
      attachment = saved;
    } catch (err) {
      console.error("Chat attachment upload failed:", err);
      return NextResponse.json(
        { error: `The file could not be uploaded right now. (Allowed: ${ALLOWED_ATTACHMENT_LABEL}, up to 5MB.)` },
        { status: 500 },
      );
    }
  }

  await sendMessage(user.id, partner.id, body, attachment);
  const messages = await getConversation(user.id, partner.id);
  return NextResponse.json({ messages });
}
