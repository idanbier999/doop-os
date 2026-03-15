// Runtime environment variable validation.
// Importing this module validates that all required vars are present.

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string): string | undefined {
  return process.env[key] || undefined;
}

// --- Public (available in browser and server) ---

export const publicEnv = {
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
} as const;

// --- Server-only (never exposed to the browser) ---

export const serverEnv = {
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  SUPABASE_JWT_SECRET: required("SUPABASE_JWT_SECRET"),
  DATABASE_URL: required("DATABASE_URL"),
  BETTER_AUTH_SECRET: required("BETTER_AUTH_SECRET"),
  BETTER_AUTH_URL: required("BETTER_AUTH_URL"),
  GOOGLE_CLIENT_ID: optional("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: optional("GOOGLE_CLIENT_SECRET"),
  BETTER_AUTH_TRUSTED_ORIGINS: optional("BETTER_AUTH_TRUSTED_ORIGINS"),
} as const;

// --- Combined export for convenience ---

export const env = {
  ...publicEnv,
  ...serverEnv,
} as const;
