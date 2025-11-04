-- ============================================================================
-- Cleanup Script: Mark Old Active Conversations as Completed
-- Run this in your Supabase SQL Editor to fix stuck "active" conversations
-- ============================================================================

-- This script will:
-- 1. Find all conversations that are still marked as "active"
-- 2. Mark them as "completed"
-- 3. Set their endedAt timestamp to the last message timestamp (or startedAt + 1 hour if no messages)

-- ============================================================================
-- STEP 1: Preview conversations that will be updated
-- ============================================================================

SELECT 
  id,
  "userId",
  language1,
  language2,
  status,
  "startedAt",
  "endedAt",
  "createdAt"
FROM conversations
WHERE status = 'active'
ORDER BY "startedAt" DESC;

-- ============================================================================
-- STEP 2: Update active conversations to completed
-- ============================================================================

-- Update conversations that have messages - use the last message timestamp as endedAt
UPDATE conversations c
SET 
  status = 'completed',
  "endedAt" = COALESCE(
    (
      SELECT MAX(timestamp)
      FROM conversation_messages
      WHERE "conversationId" = c.id
    ),
    c."startedAt" + INTERVAL '1 hour'  -- Default to 1 hour after start if no messages
  ),
  "updatedAt" = NOW()
WHERE c.status = 'active';

-- ============================================================================
-- STEP 3: Verify the update
-- ============================================================================

SELECT 
  id,
  "userId",
  language1,
  language2,
  status,
  "startedAt",
  "endedAt",
  "updatedAt"
FROM conversations
WHERE status = 'completed'
  AND "updatedAt" > NOW() - INTERVAL '1 minute'
ORDER BY "updatedAt" DESC;

-- ============================================================================
-- STEP 4: Check if any conversations are still active
-- ============================================================================

SELECT COUNT(*) as remaining_active_conversations
FROM conversations
WHERE status = 'active';

-- Expected result: 0

-- ============================================================================
-- OPTIONAL: Create a function to auto-cleanup old active conversations
-- ============================================================================

-- This function can be run periodically (e.g., daily) to clean up any stuck conversations
CREATE OR REPLACE FUNCTION cleanup_stuck_conversations()
RETURNS TABLE(updated_count INTEGER) AS $$
DECLARE
  update_count INTEGER;
BEGIN
  -- Update conversations that have been active for more than 24 hours
  UPDATE conversations c
  SET 
    status = 'completed',
    "endedAt" = COALESCE(
      (
        SELECT MAX(timestamp)
        FROM conversation_messages
        WHERE "conversationId" = c.id
      ),
      c."startedAt" + INTERVAL '1 hour'
    ),
    "updatedAt" = NOW()
  WHERE c.status = 'active'
    AND c."startedAt" < NOW() - INTERVAL '24 hours';
  
  GET DIAGNOSTICS update_count = ROW_COUNT;
  
  RETURN QUERY SELECT update_count;
END;
$$ LANGUAGE plpgsql;

-- To run the cleanup function manually:
-- SELECT * FROM cleanup_stuck_conversations();

-- ============================================================================
-- OPTIONAL: Schedule automatic cleanup (requires pg_cron extension)
-- ============================================================================

-- Uncomment the following lines if you want to schedule automatic cleanup
-- Note: pg_cron must be enabled in your Supabase project

-- SELECT cron.schedule(
--   'cleanup-stuck-conversations',  -- Job name
--   '0 2 * * *',                     -- Run daily at 2 AM
--   $$ SELECT cleanup_stuck_conversations(); $$
-- );

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('cleanup-stuck-conversations');
