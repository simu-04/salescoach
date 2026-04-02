-- Add soft-delete column to calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for trash queries
CREATE INDEX IF NOT EXISTS calls_deleted_at_idx ON calls (deleted_at) WHERE deleted_at IS NOT NULL;

-- Comment
COMMENT ON COLUMN calls.deleted_at IS 'NULL = active, non-null = in trash. Only admins can purge or restore.';
