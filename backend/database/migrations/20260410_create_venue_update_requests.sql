-- Separate moderation queue for merchant venue update requests.
-- Safe to run multiple times.

create table if not exists venue_update_requests (
  id bigserial primary key,
  venue_id bigint not null references venues(id) on delete cascade,
  submitted_by_user_id text not null,
  old_snapshot jsonb not null,
  proposed_snapshot jsonb not null,
  status varchar(24) not null default 'pending',
  rejection_reason text,
  reviewed_by text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venue_update_requests_status_chk check (status in ('pending', 'approved', 'rejected'))
);

alter table if exists venue_update_requests
  add column if not exists venue_id bigint,
  add column if not exists submitted_by_user_id text,
  add column if not exists old_snapshot jsonb,
  add column if not exists proposed_snapshot jsonb,
  add column if not exists status varchar(24) not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update venue_update_requests
set status = 'pending'
where status is null or btrim(status) = '';

alter table if exists venue_update_requests
  alter column old_snapshot set default '{}'::jsonb,
  alter column proposed_snapshot set default '{}'::jsonb;

update venue_update_requests
set old_snapshot = '{}'::jsonb
where old_snapshot is null;

update venue_update_requests
set proposed_snapshot = '{}'::jsonb
where proposed_snapshot is null;

alter table if exists venue_update_requests
  alter column venue_id set not null,
  alter column submitted_by_user_id set not null,
  alter column old_snapshot set not null,
  alter column proposed_snapshot set not null,
  alter column status set not null,
  alter column submitted_at set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table if exists venue_update_requests
  alter column old_snapshot drop default,
  alter column proposed_snapshot drop default;

create index if not exists venue_update_requests_venue_status_idx
  on venue_update_requests (venue_id, status, submitted_at desc, id desc);

create index if not exists venue_update_requests_status_submitted_idx
  on venue_update_requests (status, submitted_at desc, id desc);

create unique index if not exists venue_update_requests_pending_unique_idx
  on venue_update_requests (venue_id)
  where status = 'pending';

create index if not exists venue_update_requests_submitted_by_idx
  on venue_update_requests (submitted_by_user_id);
