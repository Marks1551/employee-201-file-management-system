import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { query, execute } from "@/shared/server/db";
import { fmt, initials } from "@/shared/server/format";
import { createSetupToken } from "@/features/auth/server/setup-tokens";
import { appUrl, sendAccountSetupEmail, sendPasswordResetEmail } from "@/features/mailer/server/service";
import { findEmployeeByNumber } from "@/features/employees/server/service";
import type { User, UserInput, UserRow, Patch, Role } from "@/shared/types";

const DEFAULT_PASSWORD = "lssti123";
const SETUP_TOKEN_TTL_HOURS = 48;
const RESET_TOKEN_TTL_HOURS = 2;

function mapUserRow(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    initials: row.initials,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    employeeId: row.employee_id,
    // Own profile photo first, otherwise the photo attached to their employee record.
    photoUrl: row.photo_url || row.employee_photo_url || null,
    lastActive: fmt(row.last_active) || "Never",
    needsPasswordSetup: !!row.needs_password_setup,
  };
}

/** Users plus the photo of their linked employee record (used as a fallback avatar). */
const USER_WITH_PHOTO_SQL =
  "SELECT u.*, e.photo_url AS employee_photo_url FROM users u LEFT JOIN employees e ON e.id = u.employee_id";

export async function listUsers(): Promise<User[]> {
  const rows = await query<UserRow>(`${USER_WITH_PHOTO_SQL} ORDER BY u.name ASC`);
  return rows.map(mapUserRow);
}

export async function getUserPublic(id: string): Promise<User | null> {
  const rows = await query<UserRow>(`${USER_WITH_PHOTO_SQL} WHERE u.id = ?`, [id]);
  return rows.length ? mapUserRow(rows[0]) : null;
}

/** Internal only — includes the password hash. Never send this to the client. */
async function getUserWithHash(id: string): Promise<UserRow | null> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0] || null;
}

/** Finds the account for a login identifier: a username, an email, or the employee
 *  number of the employee the account is linked to (faculty accounts). Username and
 *  email are tried first. Digits-only input also matches without leading zeros, so
 *  "142" finds employee #0142. */
export async function findUserByIdentifier(identifier: string): Promise<UserRow | null> {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;

  const direct = await query<UserRow>("SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ?", [id, id]);
  if (direct[0]) return direct[0];

  const exact = await query<UserRow>(
    "SELECT u.* FROM users u JOIN employees e ON e.id = u.employee_id WHERE LOWER(e.employee_number) = ? LIMIT 1",
    [id],
  );
  if (exact[0]) return exact[0];

  if (/^\d+$/.test(id)) {
    const stripped = id.replace(/^0+/, "") || "0";
    const loose = await query<UserRow>(
      "SELECT u.* FROM users u JOIN employees e ON e.id = u.employee_id WHERE TRIM(LEADING '0' FROM e.employee_number) = ? LIMIT 1",
      [stripped],
    );
    if (loose[0]) return loose[0];
  }
  return null;
}

export async function verifyPassword(userRow: UserRow, plainPassword: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, userRow.password_hash);
}

export async function createUser(data: UserInput): Promise<string> {
  const id = `user-${randomUUID()}`;
  const hash = await bcrypt.hash(data.password || DEFAULT_PASSWORD, 10);
  await execute(
    `INSERT INTO users (id, name, initials, username, email, password_hash, role, status, employee_id, last_active)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      data.name,
      initials(data.name),
      data.username,
      data.email,
      hash,
      data.role,
      "active",
      data.employeeId || null,
      null,
    ],
  );
  return id;
}

const USER_COLUMNS: Record<string, string> = {
  name: "name",
  email: "email",
  username: "username",
  role: "role",
  status: "status",
  employeeId: "employee_id",
};

export async function updateUser(id: string, patch: Patch<UserInput> & { status?: string }): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of Object.entries(USER_COLUMNS)) {
    if (key in patch) {
      sets.push(`${col} = ?`);
      params.push((patch as Record<string, unknown>)[key]);
    }
  }
  if (patch.name) {
    sets.push("initials = ?");
    params.push(initials(patch.name));
  }
  if (!sets.length) return;
  params.push(id);
  await execute(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, params);
}

export async function touchLastActive(id: string): Promise<void> {
  await execute("UPDATE users SET last_active = NOW() WHERE id = ?", [id]);
}

/** Admin-facing account creation: given just an employee number, looks up
 *  the matching employee record, auto-fills their name/email, creates the
 *  account with the chosen role, and emails them a setup link — same
 *  pending-setup flow as automatic provisioning. */
export async function createAccountForEmployeeNumber(
  employeeNumber: string,
  role: Role,
): Promise<{ ok: true; userId: string; username: string; emailSent: boolean } | { ok: false; error: string }> {
  const employee = await findEmployeeByNumber(employeeNumber);
  if (!employee) return { ok: false, error: `No employee found with employee number "${employeeNumber}".` };
  if (!employee.email)
    return {
      ok: false,
      error: `${employee.displayName} has no email address on file. Add one to their 201 file first.`,
    };

  const [existingByEmployee, existingByEmail] = await Promise.all([
    query<{ id: string }>("SELECT id FROM users WHERE employee_id = ?", [employee.id]),
    query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = ?", [employee.email.toLowerCase()]),
  ]);
  if (existingByEmployee.length || existingByEmail.length) {
    return { ok: false, error: `${employee.displayName} already has an account.` };
  }

  return provisionAccount({ name: employee.displayName, email: employee.email, role, employeeId: employee.id });
}

/** Creates an account for someone with no 201 file on record — e.g. HR or
 *  system-administrator staff who aren't tracked as employees in this
 *  system. Same emailed setup-link flow as the employee-number path, just
 *  without an employee_id to link to. */
export async function createAccountDirect(params: {
  name: string;
  email: string;
  role: Role;
}): Promise<{ ok: true; userId: string; username: string; emailSent: boolean } | { ok: false; error: string }> {
  const name = params.name.trim();
  const email = params.email.trim();
  if (!name) return { ok: false, error: "Full name is required." };
  if (!email) return { ok: false, error: "Email address is required." };

  const existingByEmail = await query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = ?", [
    email.toLowerCase(),
  ]);
  if (existingByEmail.length) return { ok: false, error: `An account with the email "${email}" already exists.` };

  return provisionAccount({ name, email, role: params.role, employeeId: null });
}

/** Shared account-creation core used by both the employee-number and direct
 *  paths: generates a username, creates the row with a random unusable
 *  password, and emails a setup link. */
async function provisionAccount(params: {
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
}): Promise<{ ok: true; userId: string; username: string; emailSent: boolean } | { ok: false; error: string }> {
  const username = await generateUniqueUsername(params.name);
  const unusablePassword = randomBytes(24).toString("hex"); // never revealed to anyone
  const userId = `user-${randomUUID()}`;
  await execute(
    `INSERT INTO users (id, name, initials, username, email, password_hash, role, status, needs_password_setup, employee_id, last_active)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      userId,
      params.name,
      initials(params.name),
      username,
      params.email,
      await bcrypt.hash(unusablePassword, 10),
      params.role,
      "active",
      true,
      params.employeeId,
      null,
    ],
  );

  const token = await createSetupToken(userId, "setup", SETUP_TOKEN_TTL_HOURS);
  const link = `${appUrl()}/account-setup?token=${token}`;
  const emailSent = await sendAccountSetupEmail({
    to: params.email,
    name: params.name,
    username,
    link,
    expiresInHours: SETUP_TOKEN_TTL_HOURS,
  });

  return { ok: true, userId, username, emailSent };
}

export async function changeUserPassword(
  id: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await getUserWithHash(id);
  if (!row) return { ok: false, error: "Account not found." };
  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) return { ok: false, error: "Your current password is incorrect." };
  const hash = await bcrypt.hash(newPassword, 10);
  await execute("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
  return { ok: true };
}

/** Lets a signed-in user rename their own login username. Requires their current
 *  password. Usernames are 3-30 chars (letters, numbers, dot, underscore, hyphen)
 *  and must not collide with any other account's username or email, since login
 *  matches either one. The session is tied to the user id, so it stays valid. */
export async function changeUsername(
  id: string,
  currentPassword: string,
  newUsername: string,
): Promise<{ ok: boolean; error?: string; username?: string }> {
  const username = newUsername.trim();
  if (username.length < 3 || username.length > 30) return { ok: false, error: "Username must be 3 to 30 characters." };
  if (!/^[A-Za-z0-9._-]+$/.test(username))
    return { ok: false, error: "Username can only use letters, numbers, dots, underscores and hyphens." };

  const row = await getUserWithHash(id);
  if (!row) return { ok: false, error: "Account not found." };
  const matches = await bcrypt.compare(currentPassword, row.password_hash);
  if (!matches) return { ok: false, error: "Your current password is incorrect." };
  if (row.username === username) return { ok: false, error: "That is already your username." };

  const lower = username.toLowerCase();
  const taken = await query<UserRow>(
    "SELECT id FROM users WHERE id <> ? AND (LOWER(username) = ? OR LOWER(email) = ?)",
    [id, lower, lower],
  );
  if (taken.length) return { ok: false, error: "That username is already taken. Please choose another." };

  try {
    await execute("UPDATE users SET username = ? WHERE id = ?", [username, id]);
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY")
      return { ok: false, error: "That username is already taken. Please choose another." };
    throw err;
  }
  return { ok: true, username };
}

// ---------- account setup / password reset (via emailed link) ----------

/** Sets a user's password directly (no current-password check) and clears
 *  the pending-setup flag. Used once a setup/reset token has been verified. */
export async function setUserPassword(id: string, newPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPassword, 10);
  await execute("UPDATE users SET password_hash = ?, needs_password_setup = FALSE WHERE id = ?", [hash, id]);
}

/** Turns "Juan Dela Cruz" into a base username candidate like "jdelacruz". */
function usernameBase(name: string): string {
  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const slug = parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1]}` : parts[0] || "user";
  return slug.replace(/[^a-z0-9]/g, "") || "user";
}

/** Finds a username that isn't already taken, appending 2, 3, ... as needed. */
async function generateUniqueUsername(name: string): Promise<string> {
  const base = usernameBase(name);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await query<{ id: string }>("SELECT id FROM users WHERE LOWER(username) = ?", [candidate]);
    if (!rows.length) return candidate;
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
}

/** Auto-provisions a login account for a newly added employee and emails
 *  them a link to set their own password (the account's real password is a
 *  random value nobody knows — direct login is refused until the link is
 *  used). No-ops (returns null) if the employee has no email on file, or if
 *  an account is already linked to them. Never throws — a mail/provisioning
 *  hiccup shouldn't block the employee record from being created. */
export async function provisionAccountForEmployee(params: {
  employeeId: string;
  name: string;
  email: string | null | undefined;
  role?: Role;
}): Promise<{ userId: string; username: string; emailSent: boolean } | null> {
  const email = params.email?.trim();
  if (!email) return null;

  try {
    const [existingByEmployee, existingByEmail] = await Promise.all([
      query<{ id: string }>("SELECT id FROM users WHERE employee_id = ?", [params.employeeId]),
      query<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = ?", [email.toLowerCase()]),
    ]);
    if (existingByEmployee.length || existingByEmail.length) return null;

    const username = await generateUniqueUsername(params.name);
    const unusablePassword = randomBytes(24).toString("hex"); // never revealed to anyone
    const userId = `user-${randomUUID()}`;
    await execute(
      `INSERT INTO users (id, name, initials, username, email, password_hash, role, status, needs_password_setup, employee_id, last_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        userId,
        params.name,
        initials(params.name),
        username,
        email,
        await bcrypt.hash(unusablePassword, 10),
        params.role || "faculty",
        "active",
        true,
        params.employeeId,
        null,
      ],
    );

    const token = await createSetupToken(userId, "setup", SETUP_TOKEN_TTL_HOURS);
    const link = `${appUrl()}/account-setup?token=${token}`;
    const emailSent = await sendAccountSetupEmail({
      to: email,
      name: params.name,
      username,
      link,
      expiresInHours: SETUP_TOKEN_TTL_HOURS,
    });

    return { userId, username, emailSent };
  } catch (err) {
    console.error("provisionAccountForEmployee failed:", err);
    return null;
  }
}

/** Re-sends the setup email for an account still waiting on password setup
 *  (e.g. the first link expired or the email bounced). Returns false if the
 *  account doesn't exist or setup was already completed. */
export async function resendSetupEmail(userId: string): Promise<boolean> {
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ?", [userId]);
  const row = rows[0];
  if (!row || !row.needs_password_setup) return false;
  const token = await createSetupToken(userId, "setup", SETUP_TOKEN_TTL_HOURS);
  const link = `${appUrl()}/account-setup?token=${token}`;
  return sendAccountSetupEmail({
    to: row.email,
    name: row.name,
    username: row.username,
    link,
    expiresInHours: SETUP_TOKEN_TTL_HOURS,
  });
}

/** Starts a self-service password reset for username/email `identifier`.
 *  Always resolves without throwing and without revealing whether the
 *  identifier matched an account, to avoid leaking which emails are
 *  registered. */
export async function requestPasswordReset(identifier: string): Promise<void> {
  const row = await findUserByIdentifier(identifier);
  if (!row || row.status === "deactivated") return;
  const token = await createSetupToken(row.id, "reset", RESET_TOKEN_TTL_HOURS);
  const link = `${appUrl()}/account-setup?token=${token}`;
  await sendPasswordResetEmail({ to: row.email, name: row.name, link, expiresInHours: RESET_TOKEN_TTL_HOURS });
}

/** Older databases don't have users.photo_url yet — add it once, automatically. */
let photoColumnReady: Promise<void> | null = null;
export function ensurePhotoColumn(): Promise<void> {
  if (!photoColumnReady) {
    photoColumnReady = (async () => {
      try {
        const rows = await query<{ COLUMN_NAME: string }>(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'photo_url'",
        );
        if (rows.length === 0)
          await execute("ALTER TABLE users ADD COLUMN photo_url VARCHAR(500) NULL AFTER employee_id");
      } catch (err) {
        console.error("ensurePhotoColumn failed:", err);
        photoColumnReady = null;
      }
    })();
  }
  return photoColumnReady;
}

/** Lets an admin/HR user rename themselves (the route restricts this to those roles). */
export async function updateOwnName(
  id: string,
  newName: string,
): Promise<{ ok: boolean; error?: string; previousName?: string }> {
  const name = newName.trim().replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 100) return { ok: false, error: "Name must be 2 to 100 characters." };
  const rows = await query<UserRow>("SELECT * FROM users WHERE id = ?", [id]);
  if (!rows[0]) return { ok: false, error: "Account not found." };
  await execute("UPDATE users SET name = ?, initials = ? WHERE id = ?", [name, initials(name), id]);
  return { ok: true, previousName: rows[0].name };
}

export async function setUserPhoto(id: string, photoUrl: string | null): Promise<void> {
  await ensurePhotoColumn();
  await execute("UPDATE users SET photo_url = ? WHERE id = ?", [photoUrl, id]);
}
