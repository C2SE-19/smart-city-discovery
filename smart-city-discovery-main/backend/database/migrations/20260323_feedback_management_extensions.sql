-- Feedback management extension: dynamic feedback types and admin reply workflow

CREATE TABLE IF NOT EXISTS feedback_types (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_types_active_sort
    ON feedback_types (is_active, sort_order, name);

INSERT INTO feedback_types (code, name, description, sort_order, is_active)
VALUES
    ('bug', 'Feature Bug', 'Something is broken or not working as expected.', 10, TRUE),
    ('feature', 'Feature Request', 'Suggest a new capability or enhancement.', 20, TRUE),
    ('ui', 'UI/UX Suggestion', 'Feedback about layout, styling, or interaction flow.', 30, TRUE),
    ('data', 'Data/Map Issue', 'Report incorrect location data, map mismatch, or missing place.', 40, TRUE),
    ('performance', 'Performance Issue', 'Slow loading, lag, or stability concerns.', 50, TRUE),
    ('payment', 'Payment/Booking Issue', 'Problems related to payment or booking experience.', 60, TRUE),
    ('other', 'Other', 'Any issue that does not fit into predefined categories.', 70, TRUE)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

ALTER TABLE feedbacks
    ADD COLUMN IF NOT EXISTS feedback_type_id BIGINT,
    ADD COLUMN IF NOT EXISTS reporter_user_id TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS admin_reply_message TEXT,
    ADD COLUMN IF NOT EXISTS admin_reply_attachment_url TEXT,
    ADD COLUMN IF NOT EXISTS admin_replied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS admin_replied_by TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'feedbacks_feedback_type_id_fkey'
          AND conrelid = 'feedbacks'::regclass
    ) THEN
        ALTER TABLE feedbacks
            ADD CONSTRAINT feedbacks_feedback_type_id_fkey
            FOREIGN KEY (feedback_type_id)
            REFERENCES feedback_types(id)
            ON DELETE SET NULL;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'feedbacks_status_check'
          AND conrelid = 'feedbacks'::regclass
    ) THEN
        ALTER TABLE feedbacks
            ADD CONSTRAINT feedbacks_status_check
            CHECK (status IN ('new', 'in_progress', 'replied', 'closed'));
    END IF;
END
$$;

UPDATE feedbacks
SET status = 'new'
WHERE status IS NULL OR status = '';

UPDATE feedbacks AS f
SET feedback_type_id = ft.id
FROM feedback_types AS ft
WHERE f.feedback_type_id IS NULL
  AND ft.code = COALESCE(NULLIF(TRIM(f.category), ''), NULLIF(TRIM(f.issue_type), ''), 'other');

CREATE INDEX IF NOT EXISTS idx_feedbacks_feedback_type_id ON feedbacks (feedback_type_id);
CREATE INDEX IF NOT EXISTS idx_feedbacks_status ON feedbacks (status);
CREATE INDEX IF NOT EXISTS idx_feedbacks_created_at ON feedbacks (created_at DESC);
