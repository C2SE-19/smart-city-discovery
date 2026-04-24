CREATE TABLE IF NOT EXISTS public.forum_post_reports (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  actor_key VARCHAR(80) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forum_post_reports_reason_chk CHECK (char_length(trim(reason)) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_forum_post_reports_post_id
  ON public.forum_post_reports (post_id);
