import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { getAllowedPartner, getThread, sendMessage, MAX_MESSAGE_LENGTH } from "@/features/chat/server/service";

/** GET /api/chat/messages?with=<userId> — the thread with that person (marks it read). */
export async function GET(request: NextRequest) {
  const user = await requireRole("hr", "faculty");
  if (user instanceof NextResponse) return user;

  const partnerId = request.nextUrl.searchParams.get("with") || "";
  const partner = await getAllowedPartner(user.role, partnerId);
  if (!partner) return NextResponse.json({ error: "You can't chat with that user." }, { status: 403 });

  const messages = await getThread(user.id, partner.id);
  return NextResponse.json({ messages });
}

/** POST /api/chat/messages { to, body } — send a message. */
export async function POST(request: NextRequest) {
  const user = await requireRole("hr", "faculty");
  if (user instanceof NextResponse) return user;

  const payload = await request.json().catch(() => ({}));
  const to = typeof payload.to === "string" ? payload.to : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";

  if (!body) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });
  if (body.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const partner = await getAllowedPartner(user.role, to);
  if (!partner) return NextResponse.json({ error: "You can't chat with that user." }, { status: 403 });

  const message = await sendMessage(user.id, partner.id, body);
  return NextResponse.json({ message });
}
