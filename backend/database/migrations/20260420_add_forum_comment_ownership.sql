ALTER TABLE IF EXISTS public.forum_comments
  ADD COLUMN IF NOT EXISTS creator_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS author_actor_key VARCHAR(80) NULL;

CREATE INDEX IF NOT EXISTS idx_forum_comments_creator_user_id
  ON public.forum_comments (creator_user_id);

CREATE INDEX IF NOT EXISTS idx_forum_comments_author_actor_key
  ON public.forum_comments (author_actor_key);
