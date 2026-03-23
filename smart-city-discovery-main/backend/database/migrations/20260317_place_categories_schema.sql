-- Shared place categories for admin/user/merchant map workflows.
-- Safe to run multiple times.

create table if not exists place_categories (
  id serial primary key,
  name varchar(120) not null,
  slug varchar(140) not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists place_categories
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists place_categories_active_sort_idx
  on place_categories (is_active desc, sort_order asc, name asc);

alter table if exists venues
  add column if not exists category_id integer references place_categories(id) on delete set null;

create index if not exists venues_category_id_idx on venues (category_id);

insert into place_categories (name, slug, description, sort_order, is_active)
values
  ('Restaurant', 'restaurant', 'Full-service restaurants and eateries.', 10, true),
  ('Cafe', 'cafe', 'Coffee shops, tea houses, and casual drink venues.', 20, true),
  ('Street Food', 'street-food', 'Street-side stalls and quick local bites.', 30, true),
  ('Bakery', 'bakery', 'Bread shops, pastry stores, and baked dessert spots.', 40, true),
  ('Bar', 'bar', 'Bars, lounges, and evening social venues.', 50, true),
  ('Dessert', 'dessert', 'Dessert-focused stores and sweet specialty shops.', 60, true),
  ('Local Market', 'local-market', 'Traditional and neighborhood market places.', 70, true),
  ('Other', 'other', 'Other place types managed by admin.', 999, true)
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
