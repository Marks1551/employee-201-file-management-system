-- Run ONCE on an existing database to add expiry dates to PRC / NBI Clearance documents.
-- (The app also adds these automatically the first time it needs them, so this is optional.)
-- Do NOT use `npm run db:seed` for this: it wipes all tables.
ALTER TABLE documents ADD COLUMN expires_on VARCHAR(60) NULL;
ALTER TABLE documents ADD COLUMN pending_expires_on VARCHAR(60) NULL;
ALTER TABLE notifications MODIFY COLUMN kind
  ENUM('missing_document','expiring_training','expiring_document','pending_document','pds_updated') NOT NULL;