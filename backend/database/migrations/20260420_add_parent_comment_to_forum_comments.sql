ALTER TABLE IF EXISTS public.forum_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT NULL REFERENCES public.forum_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_comment_id
  ON public.forum_comments (parent_comment_id);
