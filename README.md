# Employee 201 File Management System (Next.js + MySQL)

A full-stack **Next.js 15 (App Router)** app with a real **MySQL** backend: session-based
auth (JWTs in an httpOnly cookie), bcrypt-hashed passwords, and a REST API backing every
screen. No more `localStorage` — data survives restarts and is shared across users/devices.

## Quick start

```bash
npm install
cp .env.example .env.local     # then edit .env.local with your MySQL credentials
npm run db:seed                # creates the database/tables and loads demo data
npm run dev                    # http://localhost:3000
```

`npm run db:seed` is **safe to re-run any time** — it applies `db/schema.sql` (creating
tables if they don't exist yet), then wipes and reloads the demo data. Handy for resetting
things back to a clean state before a demo.

Default password for every seeded account is `lssti123` (or use a "Quick access" demo
button on the login screen).

## `db/`

```
db/
  schema.sql   MySQL DDL — the single source of truth for every table (employees,
               documents, trainings, users, audit_log, app_meta)
  seed.mjs     Applies schema.sql, then wipes and reloads demo data
               (run via `npm run db:seed`)
```

Prefer to create the database yourself (phpMyAdmin, MySQL Workbench, `mysql` CLI) instead
of letting the script do it? Run `db/schema.sql` directly:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS e201_fms CHARACTER SET utf8mb4"
mysql -u root -p e201_fms < db/schema.sql
npm run db:seed   # still safe to run afterward — it'll just seed the data
```

If you ever change the schema, edit `db/schema.sql` only — `db/seed.mjs` reads that exact
file at runtime, so there's nothing to keep in sync between the two.

## What else is in the backend

```
lib/
  db.js            MySQL connection pool (mysql2)
  auth.js          JWT session tokens, httpOnly cookie helpers
  roles.js         Shared role-label helpers + timestamp formatting
  models.js        All data access: employees, documents, trainings, users, audit log, meta
  api-helpers.js   requireUser() / requireRole() guards for route handlers

app/api/
  auth/login, auth/demo, auth/logout, auth/me, auth/change-password
  employees, employees/[id], employees/[id]/documents/[docId]
  documents/submit
  users, users/[id]
  audit-log
  meta
  backup
```

### Database schema

- **employees** — personal + employment info
- **documents** — one row per document type per employee (status: uploaded/missing)
- **trainings** — training/certification records per employee
- **users** — login accounts (bcrypt `password_hash`, role, status, optional link to an employee)
- **audit_log** — activity feed shown on the admin dashboard / audit log page
- **notifications** — persisted alerts (missing documents, expiring training certs), kept in sync automatically — see below
- **app_meta** — small key/value store (currently just `lastBackup`)

All foreign keys cascade sensibly (deleting an employee removes their documents/trainings;
deleting a linked employee just nulls out `users.employee_id`).

### Auth

Login issues a signed JWT stored in an **httpOnly, sameSite=lax** cookie
(`e201_session`, 7-day expiry). Every API route calls `requireUser()` or
`requireRole(...)` from `lib/api-helpers.js` to check the session and, where relevant,
the role — e.g. only `admin` can create/edit user accounts or trigger a backup; only
`hr`/`admin` can create or edit employee records or mark documents uploaded.

Passwords are hashed with `bcryptjs` and never sent to the client. Changing your own
password (`/api/auth/change-password`) verifies the current password server-side.

### Employee deletion

HR/Admin can permanently delete an employee's 201 file from their record page (the
"Delete" button next to Edit, with a confirmation modal). Deleting an employee cascades
to their documents, training records, and notifications; a linked user account, if any,
is **not** deleted — it's just unlinked (`employee_id` set to `NULL`) so no login access
is silently destroyed.

### Notifications (persisted entity)

Notifications are a real table, not something computed on page load. `syncNotificationsForEmployee()`
in `lib/models.js` reconciles the `notifications` table against an employee's current
document/training status every time something relevant changes — a document is uploaded,
a document is submitted by faculty, or a new employee is created. It creates a
notification the moment a document goes missing or a training starts expiring, and
deletes it the moment that's no longer true — so nothing needs to be "computed" when the
Notifications page loads; it just reads what's there. Notifications can be marked read
individually or all at once, and the sidebar badge reflects the persisted unread count.

### Employee photos

HR/Admin can attach a photo when **creating** a new employee record (in the "Add
Employee" form), and can upload or remove one later from the employee's 201 file page
(hover the avatar → camera icon). Photos are validated (JPG/PNG/WEBP, up to 5MB), saved
to `public/uploads/employees/{employeeId}.{ext}` (gitignored — this is runtime-generated,
not source), and the employee's `photo_url` column points at it. Employees without a
photo fall back to their initials in a colored circle everywhere in the UI (see the
`Avatar` component in `components/ui.jsx`).

### Backup

`POST /api/backup` (admin only) tries to run `mysqldump` and writes a real `.sql` file to
a local `backups/` folder (gitignored). If `mysqldump` isn't available on the host, it
automatically falls back to writing a JSON export of employees/users/audit log instead —
so the action stays functional either way.

## Frontend

Unchanged in spirit from the original SPA — same screens, same Tailwind v4 styling
(`app/globals.css`), same component structure. The one structural change is
`context/AppContext.jsx`: it now calls the API above instead of reading/writing
`localStorage`, but exposes the **same functions** (`login`, `addEmployee`,
`uploadDocument`, `changePassword`, etc.), so the view components needed almost no
changes.

```
app/          Route wrappers (ProtectedRoute + the real view)
views/        Actual screen components (old src/pages)
components/   Shared UI (Layout, Modal, Tabs, ui.jsx, ...)
context/      AppContext (now API-backed) + ToastContext
db/           schema.sql + seed.mjs (see above)
public/       Logo, favicon, icons
```

## Environment variables

See `.env.example`:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_APP_ENV` | `development` or `production` — see [Development vs. production mode](#development-vs-production-mode) below |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection |
| `JWT_SECRET` | Signs session cookies — set a long random string in production |
| `APP_URL` | Base URL used to build links inside emails |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Outgoing mail — if `SMTP_HOST` is blank, emails are logged instead of sent |

## Development vs. production mode

The app has one explicit mode switch, `NEXT_PUBLIC_APP_ENV` (`shared/lib/env.ts`), set via
environment variable rather than hard-coded, so you can flip it per-deployment without
touching code. It falls back to Next's own `NODE_ENV` if left unset, so local `npm run dev`
needs no configuration.

What it controls:

- **Quick-access demo login** — the "sign in instantly as any role, no password" buttons on
  the login screen. These only render, and the underlying API route only accepts requests,
  in development. In production the route returns 404 regardless of what the client sends.
- **Session cookie security** — the session cookie is marked `secure` (HTTPS-only) in
  production.
- **Startup validation** (`instrumentation.ts`) — when the server starts in production
  mode, it refuses to boot if `JWT_SECRET` is missing/still the dev default, `DB_PASSWORD`
  is empty, or `APP_URL` still points at `localhost`. It also warns (without failing) if
  `SMTP_HOST` isn't set, since that means account-setup/reset emails won't actually send.
- **Logging** — the local SMTP-not-configured fallback logs full email content (handy for
  dev); in production it just logs a one-line warning instead, so reset links don't end up
  in server logs.

## Production

```bash
npm run build
npm start
```

Before starting: set real environment variables on your host (not just a local
`.env.local`), including `NEXT_PUBLIC_APP_ENV=production`, and make sure `npm run db:seed`
(or `db/schema.sql`) has been run at least once against that database. The server will
refuse to start if required production secrets are missing — see the checklist at the
bottom of `.env.example`.
