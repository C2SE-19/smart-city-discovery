-- Admin map-management and merchant moderation schema extension.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

create table if not exists wards (
  id serial primary key,
  ward_id varchar(50) unique not null,
  name varchar(255) not null,
  boundary jsonb not null,
  created_at timestamp default current_timestamp
);

create table if not exists venues (
  id serial primary key,
  name varchar(255) not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  ward_id varchar(50) references wards(ward_id),
  created_at timestamp default current_timestamp
);

alter table if exists wards
  add column if not exists description text,
  add column if not exists is_active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists wards_ward_id_key on wards (ward_id);
create index if not exists wards_name_idx on wards (name);

alter table if exists venues
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists phone text,
  add column if not exists cover_image_url text,
  add column if not exists business_license_image_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by text,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists venues
  drop constraint if exists venues_status_check;

alter table if exists venues
  add constraint venues_status_check check (status in ('draft', 'pending', 'approved', 'rejected', 'hidden'));

update venues
set status = 'pending'
where status is null;

create index if not exists venues_status_idx on venues (status);
create index if not exists venues_submitted_at_idx on venues (submitted_at desc);
create index if not exists venues_ward_id_idx on venues (ward_id);
