ALTER TABLE IF EXISTS public.forum_posts
  ADD COLUMN IF NOT EXISTS post_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.forum_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_name VARCHAR(120) NULL,
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  anonymous_alias VARCHAR(80) NULL,
  comment_images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_comments_content_length_chk CHECK (char_length(content) > 0 AND char_length(content) <= 499),
  CONSTRAINT forum_comments_anonymous_alias_chk CHECK (
    (is_anonymous = TRUE AND anonymous_alias IS NOT NULL AND char_length(trim(anonymous_alias)) >= 2)
    OR (is_anonymous = FALSE)
  )
);

CREATE INDEX IF NOT EXISTS idx_forum_comments_post_created_desc
  ON public.forum_comments (post_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.forum_post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  actor_key VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_post_likes_unique_actor UNIQUE (post_id, actor_key)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post_id
  ON public.forum_post_likes (post_id);
