CREATE TABLE IF NOT EXISTS public.forum_comment_reports (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES public.forum_comments(id) ON DELETE CASCADE,
  actor_key VARCHAR(80) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_comment_reports_reason_length_chk CHECK (char_length(trim(reason)) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_forum_comment_reports_comment_id
  ON public.forum_comment_reports (comment_id);

CREATE INDEX IF NOT EXISTS idx_forum_comment_reports_created_at
  ON public.forum_comment_reports (created_at DESC);
