-- Add 'queued' status to conversation_status enum
-- This allows conversations to be marked as queued before processing begins

ALTER TYPE conversation_status ADD VALUE IF NOT EXISTS 'queued';

-- Update any existing conversations that should be queued
-- (This is a safety measure in case there are any stuck records)
UPDATE conversations 
SET status = 'queued' 
WHERE status = 'active' 
  AND metadata->>'conversation_type' = 'document'
  AND (metadata->'document_translation'->>'progress_percentage')::int = 0
  AND "createdAt" > NOW() - INTERVAL '1 hour';
