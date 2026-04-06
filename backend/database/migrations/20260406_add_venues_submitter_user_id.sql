-- Link venue submissions to the authenticated merchant account.
-- Safe to run multiple times.

alter table if exists venues
  add column if not exists submitted_by_user_id text;

create index if not exists venues_submitted_by_user_id_idx on venues (submitted_by_user_id);
