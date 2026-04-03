-- Add profile fields for users table
alter table if exists users
  add column if not exists phone text,
  add column if not exists birth_date text,
  add column if not exists address text,
  add column if not exists gender text,
  add column if not exists bio text;
