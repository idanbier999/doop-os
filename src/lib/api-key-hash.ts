import { randomBytes, createHash } from "crypto";

const API_KEY_PREFIX = "doop_";

/**
 * Generate a new API key: `doop_<32 hex chars>` (16 random bytes).
 */
export function generateApiKey(): string {
  return API_KEY_PREFIX + randomBytes(16).toString("hex");
}

/**
 * SHA-256 hash of the full API key, returned as a hex string.
 * Used for storage — the plaintext key is never persisted.
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

/**
 * Return the first 12 characters of the API key as a display prefix.
 * e.g. "doop_a1b2c3d4" — enough to identify the key without exposing it.
 */
export function apiKeyPrefix(apiKey: string): string {
  return apiKey.slice(0, 12);
}
