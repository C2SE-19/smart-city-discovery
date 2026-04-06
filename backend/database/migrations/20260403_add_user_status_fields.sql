-- Add fields for account status control
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'active';

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS pause_until timestamp NULL;

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

ALTER TABLE IF EXISTS users
  DROP CONSTRAINT IF EXISTS users_status_check;

ALTER TABLE IF EXISTS users
  ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'paused', 'blocked'));

-- Default existing users to active
UPDATE users SET status = 'active' WHERE status IS NULL;
