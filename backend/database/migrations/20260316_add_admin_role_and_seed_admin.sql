-- Add role support to users table and seed a default admin account.
-- Safe to run multiple times.

create extension if not exists pgcrypto;

alter table if exists users
  add column if not exists role varchar(20) not null default 'user';

alter table if exists users
  add column if not exists updated_at timestamp default current_timestamp;

alter table if exists users
  drop constraint if exists users_role_check;

alter table if exists users
  add constraint users_role_check check (role in ('admin', 'merchant', 'user'));

create index if not exists idx_users_role on users(role);

-- Seed admin account for local/project setup.
-- Username: admin
-- Password: Admin@123!
do $$
declare
  existing_user_id text;
begin
  select id::text
  into existing_user_id
  from users
  where lower(username) = 'admin' or lower(email) = 'admin@smartcity.local'
  order by id
  limit 1;

  if existing_user_id is null then
    insert into users (fullname, username, email, password, role)
    values (
      'System Administrator',
      'admin',
      'admin@smartcity.local',
      crypt('Admin@123!', gen_salt('bf')),
      'admin'
    );
  else
    update users
    set fullname = 'System Administrator',
        username = 'admin',
        email = 'admin@smartcity.local',
        password = crypt('Admin@123!', gen_salt('bf')),
        role = 'admin',
        updated_at = current_timestamp
    where id::text = existing_user_id;
  end if;
end $$;
