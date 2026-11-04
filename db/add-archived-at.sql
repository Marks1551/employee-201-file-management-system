-- Run ONCE on an existing database (e.g. your Railway MySQL) before deploying
-- the archive change. Do NOT use `npm run db:seed` for this: it wipes all tables.
ALTER TABLE trainings            ADD COLUMN archived_at VARCHAR(60) NULL;
ALTER TABLE education            ADD COLUMN archived_at VARCHAR(60) NULL;
ALTER TABLE work_experience      ADD COLUMN archived_at VARCHAR(60) NULL;
ALTER TABLE performance_reviews  ADD COLUMN archived_at VARCHAR(60) NULL;