-- Store onboarding preferences used by personalized venue recommendations.
create table if not exists user_ai_preferences (
  user_id text primary key,
  age_range_key text not null,
  preferred_gender text not null,
  preferred_times text[] not null default '{}'::text[],
  interests text[] not null default '{}'::text[],
  onboarding_completed boolean not null default true,
  last_known_latitude double precision,
  last_known_longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_ai_preferences_updated_at
  on user_ai_preferences (updated_at desc);
