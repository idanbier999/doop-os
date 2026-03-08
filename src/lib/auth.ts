import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  trustedOrigins: [
    "https://beta.tarely.xyz",
    "https://tarely.xyz",
    "https://tarely-dashboard.vercel.app",
  ],
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },
  plugins: [nextCookies()],
});
