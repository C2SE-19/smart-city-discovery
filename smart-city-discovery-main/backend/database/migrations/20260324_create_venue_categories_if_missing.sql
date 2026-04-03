-- Ensure venue_categories table exists for Supabase
create table if not exists venue_categories (
  venue_id int4 not null references venues (id) on delete cascade,
  category_id bigint not null references categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by_profile_id uuid references profiles (id) on delete set null,
  primary key (venue_id, category_id)
);

create index if not exists venue_categories_venue_id_idx on venue_categories (venue_id);
create index if not exists venue_categories_category_id_idx on venue_categories (category_id);
