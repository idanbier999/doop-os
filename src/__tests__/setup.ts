import "@testing-library/jest-dom/vitest";

// Stub environment variables for tests
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.SUPABASE_JWT_SECRET = "test-jwt-secret-at-least-32-chars-long!!";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-google-client-secret";
process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-32-chars!!";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
