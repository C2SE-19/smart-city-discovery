-- Create feedbacks table
CREATE TABLE IF NOT EXISTS feedbacks (
    id BIGSERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    issue_type TEXT,
    message TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_feedbacks_category ON feedbacks (category);

-- Ensure issue_type mirrors category for legacy queries
UPDATE feedbacks SET issue_type = category WHERE issue_type IS NULL;
