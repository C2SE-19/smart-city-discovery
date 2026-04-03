-- Shared services offered options for Merchant venue registration and Admin management.
-- Safe to run multiple times.

create table if not exists merchant_services (
  id serial primary key,
  name varchar(120) not null,
  slug varchar(140) not null unique,
  icon varchar(16),
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table if exists merchant_services
  add column if not exists icon varchar(16),
  add column if not exists description text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists merchant_services_active_sort_idx
  on merchant_services (is_active desc, sort_order asc, name asc);

insert into merchant_services (name, slug, icon, description, sort_order, is_active)
values
  ('Dine In', 'dine-in', '🪑', 'Customers can sit and dine at the venue.', 10, true),
  ('Takeaway', 'takeaway', '🛍️', 'Orders can be packed for takeaway.', 20, true),
  ('Delivery', 'delivery', '🚚', 'Venue supports home delivery service.', 30, true),
  ('Outdoor Seating', 'outdoor-seating', '🌳', 'Outdoor table or seating is available.', 40, true),
  ('Parking', 'parking', '🅿️', 'Parking area is available for customers.', 50, true),
  ('WiFi', 'wifi', '📶', 'Free or paid WiFi is available.', 60, true),
  ('Live Music', 'live-music', '🎵', 'Live music sessions are provided.', 70, true),
  ('Private Events', 'private-events', '🎉', 'Venue accepts private event bookings.', 80, true)
on conflict (slug)
do update set
  name = excluded.name,
  icon = excluded.icon,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();
