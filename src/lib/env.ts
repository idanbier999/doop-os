// Runtime environment variable validation.
// In dev mode with embedded-postgres, DATABASE_URL is auto-set by scripts/dev.mjs.

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

// --- Server-only (never exposed to the browser) ---

export const serverEnv = {
  DATABASE_URL: optional("DATABASE_URL"),
} as const;

// --- Combined export for convenience ---

export const env = {
  ...serverEnv,
} as const;
