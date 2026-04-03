-- Create user favorites table
create table if not exists user_favorites (
  id bigserial primary key,
  user_id uuid not null references users (id) on delete cascade,
  item_id text not null,
  item_type text not null,
  name text,
  image text,
  price text,
  description text,
  created_at timestamptz not null default now(),
  unique (user_id, item_id, item_type)
);

create index if not exists idx_user_favorites_user on user_favorites (user_id);
