import { NextResponse, type NextRequest } from "next/server";
import { findUserByIdentifier, verifyPassword, getUserPublic, touchLastActive } from "@/features/users/server/service";
import { logAs } from "@/features/audit-log/server/service";
import { setSessionCookie } from "@/features/auth/server/session";

export async function POST(request: NextRequest) {
  const { identifier, password } = await request.json();
  if (typeof identifier !== "string" || !identifier.trim() || typeof password !== "string" || !password) {
    return NextResponse.json({ error: "Please enter your username or employee ID and password." }, { status: 400 });
  }

  const userRow = await findUserByIdentifier(identifier);
  if (!userRow) {
    return NextResponse.json({ error: "Username or employee ID not found." }, { status: 401 });
  }
  if (!userRow.needs_password_setup && !(await verifyPassword(userRow, password))) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }
  if (userRow.needs_password_setup) {
    return NextResponse.json(
      { error: "Your account is not set up yet. Please use the link emailed to you." },
      { status: 403 },
    );
  }
  if (userRow.status === "deactivated") {
    return NextResponse.json(
      { error: "This account is deactivated. Please contact your administrator." },
      { status: 403 },
    );
  }

  await setSessionCookie(userRow.id);
  await touchLastActive(userRow.id);
  await logAs(userRow, "Signed in");

  const user = await getUserPublic(userRow.id);
  return NextResponse.json({ user });
}
