import { NextResponse, type NextRequest } from "next/server";
import { putObject, deleteObjectsWithPrefix } from "@/shared/server/r2";
import { requireRole } from "@/shared/server/api-helpers";
import { setUserPhoto, getUserPublic } from "@/features/users/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

const KEY_PREFIX = "users";
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Admin and HR can set their own profile picture. Faculty cannot — HR sets
 *  faculty photos on the employee record. */
export async function POST(request: NextRequest) {
  const user = await requireRole("admin", "hr");
  if (user instanceof NextResponse) return user;

  const formData = await request.formData();
  const file = formData.get("photo");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No photo file was provided." }, { status: 400 });
  }
  if (!ALLOWED_TYPES[file.type]) {
    return NextResponse.json({ error: "Please upload a JPG, PNG, or WEBP image." }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Photo must be smaller than 5MB." }, { status: 400 });
  }

  await deleteObjectsWithPrefix(`${KEY_PREFIX}/${user.id}.`);
  const url = await putObject(`${KEY_PREFIX}/${user.id}.${ALLOWED_TYPES[file.type]}`, file, file.type);
  await setUserPhoto(user.id, `${url}?v=${Date.now()}`);
  await addAuditLog(user.name, roleLabel(user.role), "Updated their profile picture");

  return NextResponse.json({ user: await getUserPublic(user.id) });
}

export async function DELETE() {
  const user = await requireRole("admin", "hr");
  if (user instanceof NextResponse) return user;

  await deleteObjectsWithPrefix(`${KEY_PREFIX}/${user.id}.`);
  await setUserPhoto(user.id, null);
  await addAuditLog(user.name, roleLabel(user.role), "Removed their profile picture");

  return NextResponse.json({ user: await getUserPublic(user.id) });
}
