-- Migration: Replace plaintext api_key with hashed api_key_hash + api_key_prefix
-- This prevents API key exposure in the event of a database compromise.

-- 1. Enable pgcrypto for SHA-256 hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add new columns
ALTER TABLE agents ADD COLUMN api_key_hash text;
ALTER TABLE agents ADD COLUMN api_key_prefix text;

-- 3. Migrate existing plaintext keys to hashed values.
-- NOTE: Old keys were UUIDs (e.g. "550e8400-e29b-..."). New keys use "doop_<hex>" format.
-- The backfilled hashes are based on the old UUID text representation, so existing agents
-- will need to re-register to get a new doop_-format key. This is intentional — all
-- pre-migration keys are effectively invalidated by the format change.
UPDATE agents
SET
  api_key_hash = encode(digest(api_key::text, 'sha256'), 'hex'),
  api_key_prefix = left(api_key::text, 12)
WHERE api_key IS NOT NULL;

-- 4. Drop the plaintext column
ALTER TABLE agents DROP COLUMN api_key;

-- 5. Enforce constraints: every agent must have a hash, and hashes must be unique
ALTER TABLE agents ALTER COLUMN api_key_hash SET NOT NULL;
ALTER TABLE agents ALTER COLUMN api_key_prefix SET NOT NULL;

-- 6. Add unique index on api_key_hash for fast lookup + collision prevention
CREATE UNIQUE INDEX idx_agents_api_key_hash ON agents (api_key_hash);
