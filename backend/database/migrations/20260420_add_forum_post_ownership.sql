ALTER TABLE IF EXISTS public.forum_posts
  ADD COLUMN IF NOT EXISTS creator_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_actor_key VARCHAR(80) NULL;

CREATE INDEX IF NOT EXISTS idx_forum_posts_creator_user_id
  ON public.forum_posts (creator_user_id);

CREATE INDEX IF NOT EXISTS idx_forum_posts_author_actor_key
  ON public.forum_posts (author_actor_key);
