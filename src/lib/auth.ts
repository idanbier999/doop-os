import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { env } from "@/lib/env";

function parseTrustedOrigins(): string[] | undefined {
  const raw = env.BETTER_AUTH_TRUSTED_ORIGINS;
  if (!raw) return undefined;
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
    .filter((origin) => {
      if (/^https?:\/\/.+/.test(origin)) return true;
      console.warn(
        `[auth] Ignoring invalid trusted origin (must start with http:// or https://): ${origin}`
      );
      return false;
    });
}

export const auth = betterAuth({
  database: new Pool({
    connectionString: env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
  trustedOrigins: parseTrustedOrigins(),
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  plugins: [nextCookies()],
});
