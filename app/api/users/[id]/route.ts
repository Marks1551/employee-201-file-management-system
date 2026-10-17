import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/shared/server/api-helpers";
import {
  getUserPublic,
  updateUser,
  deleteUser,
  countAdmins,
  findEmailConflict,
  findUsernameConflict,
} from "@/features/users/server/service";
import { addAuditLog } from "@/features/audit-log/server/service";
import { roleLabel } from "@/shared/lib/roles";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const patch = await request.json();
  const existing = await getUserPublic(id);
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  // Email and username must be unique across accounts — say so clearly instead of failing silently.
  if (typeof patch.email === "string") {
    patch.email = patch.email.trim();
    if (!patch.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }
    const owner = await findEmailConflict(patch.email, id);
    if (owner) {
      return NextResponse.json(
        {
          error: `The email address ${patch.email} is already used by another account (${owner}). Please use a different email.`,
        },
        { status: 409 },
      );
    }
  }
  if (typeof patch.username === "string") {
    patch.username = patch.username.trim();
    if (!patch.username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
    const owner = await findUsernameConflict(patch.username, id);
    if (owner) {
      return NextResponse.json(
        { error: `The username "${patch.username}" is already taken by ${owner}. Please choose another.` },
        { status: 409 },
      );
    }
  }

  try {
    await updateUser(id, patch);
  } catch (err) {
    // Safety net for a race between the check above and the update.
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json(
        { error: "That email address or username is already used by another account." },
        { status: 409 },
      );
    }
    throw err;
  }

  if ("status" in patch) {
    await addAuditLog(
      user.name,
      roleLabel(user.role),
      `${patch.status === "active" ? "Reactivated" : "Deactivated"} account for ${existing.name}`,
    );
  } else if ("role" in patch && patch.role !== existing.role) {
    await addAuditLog(user.name, roleLabel(user.role), `Changed ${existing.name}'s role to ${roleLabel(patch.role)}`);
  }

  const updated = await getUserPublic(id);
  return NextResponse.json({ user: updated });
}

/** System administrators can permanently delete a login account. The employee's 201 file is kept. */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await requireRole("admin");
  if (user instanceof NextResponse) return user;

  const { id } = await params;
  const existing = await getUserPublic(id);
  if (!existing) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (existing.id === user.id) {
    return NextResponse.json({ error: "You can't delete the account you're signed in with." }, { status: 400 });
  }
  if (existing.role === "admin" && (await countAdmins()) <= 1) {
    return NextResponse.json({ error: "You can't delete the only system administrator account." }, { status: 400 });
  }

  await deleteUser(id);
  await addAuditLog(
    user.name,
    roleLabel(user.role),
    `Deleted ${roleLabel(existing.role)} account for ${existing.name} (${existing.email})`,
  );
  return NextResponse.json({ ok: true });
}
