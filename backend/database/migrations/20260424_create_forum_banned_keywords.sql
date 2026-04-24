CREATE TABLE IF NOT EXISTS public.forum_banned_keywords (
  id BIGSERIAL PRIMARY KEY,
  keyword VARCHAR(160) NOT NULL,
  normalized_keyword VARCHAR(160) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_banned_keywords_created_at
  ON public.forum_banned_keywords (created_at DESC);
