-- Optional: run ONCE on an existing database to add the columns introduced by
-- CS Form No. 212 (Revised 2026). The app also adds these automatically the first
-- time an education / work-experience record is saved, so this is only needed if you
-- prefer to migrate up front. Do NOT use `npm run db:seed` for this: it wipes all tables.
ALTER TABLE education       ADD COLUMN period_from         VARCHAR(20)  NULL;
ALTER TABLE education       ADD COLUMN period_to           VARCHAR(20)  NULL;
ALTER TABLE education       ADD COLUMN highest_level_units VARCHAR(150) NULL;
ALTER TABLE work_experience ADD COLUMN monthly_salary      VARCHAR(40)  NULL;
ALTER TABLE work_experience ADD COLUMN salary_grade        VARCHAR(20)  NULL;