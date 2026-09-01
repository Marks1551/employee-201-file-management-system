-- Employee 201 File Management System — MySQL schema
--
-- This is the single source of truth for the schema. db/seed.mjs reads and
-- executes this exact file (after creating/selecting the database from your .env),
-- so editing this file is enough — there is no separate copy to keep in sync.
--
-- To import manually instead (phpMyAdmin / MySQL Workbench / mysql CLI), create and
-- select your database first, then run this file against it, e.g.:
--   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS e201_fms CHARACTER SET utf8mb4"
--   mysql -u root -p e201_fms < db/schema.sql

-- ---------------------------------------------------------------------------
-- employees: one row per personnel 201 file
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employees (
  id                 VARCHAR(64)  PRIMARY KEY,
  employee_number    VARCHAR(20)  NOT NULL UNIQUE,
  initials           VARCHAR(5)   NOT NULL,
  full_name          VARCHAR(150) NOT NULL,
  display_name       VARCHAR(150) NOT NULL,
  dob                VARCHAR(60),
  civil_status       VARCHAR(30),
  nationality        VARCHAR(60),
  contact            VARCHAR(40),
  email              VARCHAR(150),
  address            VARCHAR(255),
  department         VARCHAR(120),
  position           VARCHAR(120),
  employment_type    VARCHAR(40),
  date_hired         VARCHAR(60),
  employment_status  VARCHAR(40),
  contract_start     VARCHAR(60),
  contract_end       VARCHAR(60),
  supervisor         VARCHAR(150),
  photo_url          VARCHAR(500),
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',
  deactivation_reason VARCHAR(60),
  deactivated_at     VARCHAR(60),
  -- Additional CS Form No. 212 (PDS) fields not covered by the columns above,
  -- stored as one JSON blob (family background, IDs, other info,
  -- declarations, references, etc.) — see shared/types.ts `PdsDetails`.
  pds_details        LONGTEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- documents: one row per required document type per employee
-- ---------------------------------------------------------------------------
-- status lifecycle: missing -> pending (faculty submitted, awaiting HR review)
-- -> uploaded (HR approved, now the file of record) or back to missing/uploaded
-- (HR rejected, previous file of record — if any — is left untouched).
CREATE TABLE IF NOT EXISTS documents (
  id                  VARCHAR(64)  PRIMARY KEY,
  employee_id         VARCHAR(64)  NOT NULL,
  name                VARCHAR(150) NOT NULL,
  status              ENUM('uploaded','missing','pending','rejected') NOT NULL DEFAULT 'missing',
  uploaded_at         VARCHAR(60),
  file_url            VARCHAR(500),
  file_name           VARCHAR(255),
  file_type           VARCHAR(100),
  -- Faculty's submitted file, awaiting HR review. Only copied into the
  -- file_* columns above once HR approves — nothing is applied to the
  -- employee's record of file until that happens.
  pending_file_url    VARCHAR(500),
  pending_file_name   VARCHAR(255),
  pending_file_type   VARCHAR(100),
  submitted_at        VARCHAR(60),
  reviewed_by          VARCHAR(150),
  reviewed_at          VARCHAR(60),
  review_note          VARCHAR(500),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- trainings: training / certification records per employee
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trainings (
  id             VARCHAR(64)  PRIMARY KEY,
  employee_id    VARCHAR(64)  NOT NULL,
  course         VARCHAR(200) NOT NULL,
  provider       VARCHAR(150),
  completed      VARCHAR(60),
  cert_status    ENUM('on-file','expiring') DEFAULT 'on-file',
  cert_file_url  VARCHAR(500),
  cert_file_name VARCHAR(255),
  cert_file_type VARCHAR(100),
  -- PDS Section VII (Learning & Development) extras
  from_date      VARCHAR(60),
  hours          VARCHAR(20),
  ld_type        VARCHAR(60),
  conducted_by   VARCHAR(200),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- education: educational background records per employee (separate from
-- trainings/certifications above)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS education (
  id              VARCHAR(64)  PRIMARY KEY,
  employee_id     VARCHAR(64)  NOT NULL,
  level           VARCHAR(60),
  school_name     VARCHAR(200) NOT NULL,
  degree          VARCHAR(200),
  year_graduated  VARCHAR(20),
  honors          VARCHAR(150),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- work_experience: prior employment history per employee
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_experience (
  id           VARCHAR(64)  PRIMARY KEY,
  employee_id  VARCHAR(64)  NOT NULL,
  company      VARCHAR(200) NOT NULL,
  position     VARCHAR(150),
  from_date    VARCHAR(60),
  to_date      VARCHAR(60),
  description  VARCHAR(500),
  -- PDS Section V (Work Experience) extras
  status_of_appointment VARCHAR(100),
  govt_service          ENUM('Y','N'),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- civil_service_eligibility: PDS Section IV
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS civil_service_eligibility (
  id             VARCHAR(64)  PRIMARY KEY,
  employee_id    VARCHAR(64)  NOT NULL,
  name           VARCHAR(255) NOT NULL,
  rating         VARCHAR(30),
  exam_date      VARCHAR(60),
  exam_place     VARCHAR(150),
  license_number VARCHAR(60),
  license_valid_until VARCHAR(60),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- voluntary_work: PDS Section VI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS voluntary_work (
  id           VARCHAR(64)  PRIMARY KEY,
  employee_id  VARCHAR(64)  NOT NULL,
  organization VARCHAR(255) NOT NULL,
  from_date    VARCHAR(60),
  to_date      VARCHAR(60),
  hours        VARCHAR(20),
  position     VARCHAR(150),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- pds_references: PDS Section 41 (character references)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pds_references (
  id           VARCHAR(64)  PRIMARY KEY,
  employee_id  VARCHAR(64)  NOT NULL,
  name         VARCHAR(200) NOT NULL,
  address      VARCHAR(255),
  contact      VARCHAR(150),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- performance_reviews: performance evaluation records per employee
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS performance_reviews (
  id           VARCHAR(64)  PRIMARY KEY,
  employee_id  VARCHAR(64)  NOT NULL,
  period       VARCHAR(60)  NOT NULL,
  rating       VARCHAR(60),
  reviewer     VARCHAR(150),
  remarks      VARCHAR(500),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- attendance_records: periodic attendance summaries per employee
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_records (
  id            VARCHAR(64)  PRIMARY KEY,
  employee_id   VARCHAR(64)  NOT NULL,
  period        VARCHAR(60)  NOT NULL,
  days_present  INT,
  days_absent   INT,
  days_late     INT,
  remarks       VARCHAR(255),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- users: login accounts (System Administrator / HR Personnel / Faculty)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   VARCHAR(64)  PRIMARY KEY,
  name                 VARCHAR(150) NOT NULL,
  initials             VARCHAR(5),
  username             VARCHAR(60)  NOT NULL UNIQUE,
  email                VARCHAR(150) NOT NULL UNIQUE,
  password_hash        VARCHAR(255) NOT NULL,
  role                 ENUM('admin','hr','faculty') NOT NULL,
  status               ENUM('active','deactivated') NOT NULL DEFAULT 'active',
  -- TRUE for accounts that were auto-created (e.g. when an employee record is
  -- added) and are waiting for the person to pick their own password via the
  -- emailed setup link. Direct password login is refused while this is true.
  needs_password_setup BOOLEAN      NOT NULL DEFAULT FALSE,
  employee_id          VARCHAR(64),
  last_active          TIMESTAMP NULL,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- account_setup_tokens: one-time links emailed to a user so they can pick a
-- password — either to activate a brand-new auto-created account ('setup')
-- or to recover access to an existing one ('reset'). Only a SHA-256 hash of
-- the token is stored; the raw token only ever exists in the emailed link.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account_setup_tokens (
  id          VARCHAR(64) PRIMARY KEY,
  user_id     VARCHAR(64) NOT NULL,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  purpose     ENUM('setup','reset') NOT NULL DEFAULT 'setup',
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- audit_log: activity feed (admin dashboard / audit log page)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id          VARCHAR(64) PRIMARY KEY,
  who         VARCHAR(150),
  role        VARCHAR(60),
  action      VARCHAR(255),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- notifications: persisted alerts (missing documents, expiring certifications),
-- kept in sync automatically whenever documents/trainings change
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id           VARCHAR(64) PRIMARY KEY,
  employee_id  VARCHAR(64) NOT NULL,
  document_id  VARCHAR(64),
  training_id  VARCHAR(64),
  kind         ENUM('missing_document','expiring_training','pending_document') NOT NULL,
  title        VARCHAR(200) NOT NULL,
  detail       VARCHAR(255),
  status       ENUM('unread','read') NOT NULL DEFAULT 'unread',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- app_meta: small key/value store (currently just last backup timestamp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_meta (
  meta_key    VARCHAR(60) PRIMARY KEY,
  meta_value  VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
