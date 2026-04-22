CREATE TABLE IF NOT EXISTS public.forum_posts (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  content TEXT NOT NULL,
  author_name VARCHAR(120) NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  anonymous_alias VARCHAR(80) NULL,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_posts_content_length_chk CHECK (char_length(content) > 0 AND char_length(content) <= 499),
  CONSTRAINT forum_posts_anonymous_alias_chk CHECK (
    (is_anonymous = TRUE AND anonymous_alias IS NOT NULL AND char_length(trim(anonymous_alias)) >= 2)
    OR (is_anonymous = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_created_at_desc ON public.forum_posts (created_at DESC);
