import { NextResponse } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import { listContacts } from "@/features/chat/server/service";

// HR and Faculty only — admins get a 403.
export async function GET() {
  const user = await requireRole("hr", "faculty");
  if (user instanceof NextResponse) return user;
  const contacts = await listContacts(user.id, user.role);
  return NextResponse.json({ contacts });
}
