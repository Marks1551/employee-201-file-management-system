# Employee 201 File Management System

A web app for managing employee **201 files** (personnel records) for a school: employee
records and Personal Data Sheet (PDS) details, required-document tracking with an
HR approval workflow, notifications, announcements, HR–faculty chat, reports, audit
logging and database backup, with role-based access for **Admin**, **HR Personnel** and
**Faculty**.

Built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS v4**
and **MySQL**. Uploaded files (documents, photos, chat attachments) are stored in
**Firebase Storage**.

## Features

**Faculty**

- View their own 201 file and which required documents are on file, missing or rejected
- Submit documents for HR review (status becomes _pending_ until HR approves or rejects)
- Receive announcements and chat with HR

**HR Personnel**

- Create, edit, deactivate and delete employee records, including photo, employment
  status (Regular / Contractual with contract end date), department and PDS details
- Manage each employee's PDS sections: education, work experience, civil service
  eligibility, voluntary work, trainings (with certificates), references, performance
  reviews, attendance and government benefits
- Upload documents directly, or **approve / reject** documents submitted by faculty
- Add or remove required document types for all employees
- Search records, publish announcements, chat with faculty
- Generate Excel reports (Employee List, Document Status) and export or print an
  individual employee's file

**Admin**

- Create and invite user accounts, assign roles, activate / deactivate accounts
- View the audit log of system activity
- Download a full SQL backup of the database

**Everyone**

- Username/password sign-in, **fingerprint login** (WebAuthn / passkeys), forgot-password
  email flow, change password and username, profile photo
- Persisted notifications (missing documents, expiring training certificates, pending
  submissions, PDS updates) with an unread badge in the sidebar

## Tech stack

| Area         | Tools                                                                                  |
| ------------ | -------------------------------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router, route handlers), React 19, TypeScript                          |
| Styling / UI | Tailwind CSS v4, lucide-react icons                                                    |
| Database     | MySQL via `mysql2` (connection pool)                                                   |
| Auth         | JWT in an httpOnly cookie (`jsonwebtoken`), `bcryptjs`, WebAuthn (`@simplewebauthn/*`) |
| File storage | Firebase Storage via `firebase-admin`                                                  |
| Email        | `nodemailer` (SMTP)                                                                    |
| Reports      | `exceljs`                                                                              |

## Quick start

**Prerequisites:** Node.js 18.18+ (required by Next.js 15) and a running MySQL server.

```bash
npm install
# create .env.local (see "Environment variables" below), then:
npm run db:seed     # creates the database and tables, loads demo data
npm run dev         # http://localhost:3000
```

> ⚠️ **`npm run db:seed` is destructive.** It applies `db/schema.sql`, drops
> `webauthn_credentials`, **truncates every table** and reloads the demo data. It is handy
> for resetting a local or demo database, but **never run it against a database that holds
> real data.**

In development, the login screen shows **quick access** buttons that sign you in as any
role without a password.

### Demo accounts

The seed creates **7 accounts**: 1 system admin, 1 HR and 5 faculty (each faculty account is
linked to an employee record).

| Role    | Username     | Password     |
| ------- | ------------ | ------------ |
| Admin   | `ladmin`     | `lsstiadmin` |
| HR      | `areyes`     | `lssti123`   |
| Faculty | `jvillareal` | `lssti123`   |
| Faculty | `cbautista`  | `lssti123`   |
| Faculty | `tmendez`    | `lssti123`   |
| Faculty | `dcruz`      | `lssti123`   |
| Faculty | `mong`       | `lssti123`   |

`ladmin` is the default admin account. Change its password after first sign-in on any
shared or deployed instance.

## Environment variables

Create `.env.local` in the project root. (`.env*` files are gitignored, so there is no
`.env.example` in the repository — use the template below.)

```bash
# --- App mode ---
NEXT_PUBLIC_APP_ENV=development        # "development" or "production"
APP_URL=http://localhost:3000          # base URL used in email links

# --- MySQL ---
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=e201_fms

# --- Sessions ---
JWT_SECRET=change-me-to-a-long-random-string

# --- Firebase Storage (documents, photos, chat attachments) ---
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app

# --- Email (optional in development) ---
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=

# --- Fingerprint login (optional) ---
WEBAUTHN_RP_ID=
WEBAUTHN_ORIGIN=
```

| Variable                                                  | Purpose                                                                                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_ENV`                                     | Explicit dev/production switch. Falls back to `NODE_ENV` if unset. See [Development vs. production](#development-vs-production-mode).                                                       |
| `APP_URL`                                                 | Base URL used to build links in account-setup and password-reset emails.                                                                                                                    |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection. `DB_NAME` defaults to `e201_fms`.                                                                                                                                         |
| `JWT_SECRET`                                              | Signs session cookies. Must be a long random string in production.                                                                                                                          |
| `FIREBASE_*`                                              | Firebase service-account credentials and bucket (Firebase console → Project settings → Service accounts). Keep the `\n` escapes if the private key is on one line. Required for any upload. |
| `SMTP_*`                                                  | Outgoing mail. If `SMTP_HOST` is blank, emails are logged to the server console instead of sent.                                                                                            |
| `WEBAUTHN_RP_ID`, `WEBAUTHN_ORIGIN`                       | Optional overrides for fingerprint login in production. Default to the host/origin of `APP_URL`. In development they are taken from the incoming request.                                   |
| `R2_*`                                                    | Legacy Cloudflare R2 settings, only used by `db/migrate-r2-to-firebase.mjs` (and see the note under [Known issues](#known-issues)).                                                         |

## Project structure

```
app/            Next.js routes: pages per role (admin/, hr/, faculty/), auth pages,
                and REST route handlers under app/api/
features/       Feature modules, each with components/ (UI) and server/ (data access):
                  auth, users, employees (incl. documents), notifications,
                  announcements, chat, audit-log, backup, dashboard, mailer
shared/
  components/   Layout, Modal, Table, Tabs, Pagination, nav config, shared pages
  context/      AppContext (API-backed client state) and ToastContext
  lib/          Client/server-safe helpers: roles, env, PDS, Excel/print/export
  server/       DB pool, Firebase storage, API guards, meta key/value store
db/             schema.sql, seed.mjs and maintenance scripts
public/         Logo, favicon, icons
instrumentation.ts   Production startup validation
```

The `@/*` import alias maps to the project root.

## Database

`db/schema.sql` is the single source of truth for the schema; `db/seed.mjs` reads that exact
file, so there is nothing to keep in sync.

| Group           | Tables                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employees & PDS | `employees`, `education`, `work_experience`, `civil_service_eligibility`, `voluntary_work`, `pds_references`, `trainings`, `performance_reviews`, `attendance_records` |
| Documents       | `documents`, `document_requirements`, `removed_document_requirements`                                                                                                  |
| Accounts & auth | `users`, `account_setup_tokens`, `webauthn_credentials`                                                                                                                |
| Activity        | `audit_log`, `notifications`, `messages`, `app_meta`                                                                                                                   |

Prefer to create the database yourself (phpMyAdmin, MySQL Workbench, CLI)?

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS e201_fms CHARACTER SET utf8mb4"
mysql -u root -p e201_fms < db/schema.sql
```

Only run `npm run db:seed` afterward if you want the demo data (it will wipe existing rows).

### Scripts in `db/`

| Command                                                    | What it does                                                                                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:seed`                                          | Applies the schema, **wipes** all tables and loads demo data.                                                                                           |
| `node db/backfill-required-documents.mjs`                  | Adds any missing required-document rows (marked _missing_) and matching HR notifications to **existing** employees. Safe to re-run; does not wipe data. |
| `node --env-file=.env.local db/migrate-r2-to-firebase.mjs` | One-time migration of files from Cloudflare R2 to Firebase Storage, rewriting saved links. Supports `--dry-run`. Old R2 files are not deleted.          |

## How it works

### Authentication and roles

Sign-in issues a signed JWT stored in an **httpOnly, sameSite=lax** cookie
(`e201_session`, 7-day expiry, `secure` in production). Passwords are hashed with
`bcryptjs` and never sent to the client. Every API route calls `requireUser()` or
`requireRole(...)` from `shared/server/api-helpers.ts`.

| Capability                              | Admin | HR  | Faculty |
| --------------------------------------- | :---: | :-: | :-----: |
| Manage user accounts, invites, roles    |  ✅   |     |         |
| Database backup                         |  ✅   |     |         |
| Create / edit / delete employee records |  ✅   | ✅  |         |
| Approve / reject submitted documents    |  ✅   | ✅  |         |
| Manage required document types          |  ✅   | ✅  |         |
| Post announcements                      |  ✅   | ✅  |         |
| Chat (HR ↔ Faculty)                     |       | ✅  |   ✅    |
| Submit documents                        |       |     |   ✅    |

**Account setup and password reset** use single-use, expiring tokens delivered by email.
**Fingerprint login** uses WebAuthn: the device keeps the private key and unlocks it with its
own fingerprint sensor; the server stores only the public key and no biometric data. A
fingerprint is bound to the domain it was registered on, so changing the production domain
invalidates registered fingerprints.

### Document workflow

Each employee has one row per required document type. A document is `missing`,
`pending` (faculty submitted a file, awaiting review), `uploaded` (on file) or `rejected`.
Approving a submission makes it the file of record; rejecting it returns it to the
employee for replacement. A 201 file counts as **Complete** only when nothing is missing
and nothing is rejected.

Default required documents: Government-Issued ID, Diploma / Transcript of Records, NBI
Clearance, Employment Contract, Medical Certificate, License and PRC. HR can add or remove
types; new employees pick up the current list.

### Notifications

Notifications are a real table, kept in sync automatically rather than computed on page
load. Whenever a document or training changes, or an employee is created, the system
reconciles that employee's notifications: it creates one the moment a document goes
missing, a certificate starts expiring, a submission is pending or a PDS is updated, and
removes it as soon as it no longer applies. They can be marked read individually or all at
once.

### Employee records, deactivation and deletion

HR/Admin can **deactivate** an employee's 201 file with a reason (Resigned, End of Contract,
Retired, Job Abandonment or Terminated), which keeps the record but marks it inactive.
They can also **permanently delete** a record. Deleting cascades to the employee's
documents, trainings and notifications; a linked user account is **not** deleted, only
unlinked (`employee_id` set to `NULL`), so no login is silently destroyed.

### Files and photos

Documents, employee/profile photos and chat attachments are uploaded to Firebase Storage
(`shared/server/storage.ts`) because serverless/container hosts have ephemeral filesystems.
Limit: 10 MB per file (photos, 201-file documents and chat attachments). Chat accepts images, PDF, Word, Excel, PowerPoint, TXT and CSV
(types that can execute in a browser, such as HTML/SVG/JS, are rejected). Employees without a
photo show their initials in a colored circle.

### Backup

`POST /api/backup` (admin only) generates a full `.sql` dump of every table in pure Node
(no `mysqldump` required) and returns it as a download. The time of the last backup is
recorded and the action is written to the audit log.

### Reports and exports

HR can generate an **Employee List Report** and a **Document Status Report** as Excel
workbooks, and export or print an individual employee's 201 file.

## Development vs. production mode

The app has one explicit mode switch, `NEXT_PUBLIC_APP_ENV` (`shared/lib/env.ts`), so you can
flip it per deployment without touching code. It falls back to `NODE_ENV`, so a plain
`npm run dev` needs no configuration.

- **Quick-access demo login**: the passwordless role buttons and the `/api/auth/demo` route
  exist only in development. In production the route returns 404.
- **Session cookie**: marked `secure` (HTTPS-only) in production.
- **Startup validation** (`instrumentation.ts`): in production the server refuses to start if
  `JWT_SECRET` is missing or still the dev default, `DB_PASSWORD` is empty, or `APP_URL` is
  unset or points at `localhost`. It warns (without failing) if `SMTP_HOST` is not set.
- **Logging**: with no SMTP configured, development logs the full email (handy for setup
  links); production logs only a one-line warning so links don't end up in server logs.

## Production

```bash
npm run build
npm start
```

Before starting, set real environment variables on your host (not just a local
`.env.local`), including `NEXT_PUBLIC_APP_ENV=production`, and make sure `db/schema.sql` has
been applied to the production database. **Do not use `npm run db:seed` on production**,
since it truncates every table.

The repo includes a `nixpacks.toml` for [Railway](https://railway.app) deployments (Nixpacks
builds). It installs the MySQL client tools; the in-app backup no longer needs them, so
that step is optional.

## Scripts

| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start the dev server on port 3000                   |
| `npm run build`   | Production build                                    |
| `npm start`       | Run the production build                            |
| `npm run lint`    | Run `next lint`                                     |
| `npm run db:seed` | Apply schema and reload demo data (**destructive**) |

## Known issues

- `app/api/files/download/route.ts` still imports from the legacy `shared/server/r2.ts`
  instead of `shared/server/storage.ts`. Its `keyFromPublicUrl` only recognizes URLs under
  `R2_PUBLIC_URL`, so "Download" links for files stored in Firebase will likely return
  _"Unknown file."_ until the import is switched to `storage.ts`.
- `db/backfill-required-documents.mjs` mentions an `npm run db:backfill-docs` script that is
  not defined in `package.json`; run it with `node` as shown above.
- Both `package-lock.json` and `pnpm-lock.yaml` are committed; pick one package manager to
  avoid drift.
