import "@testing-library/jest-dom/vitest";

// Stub environment variables for tests
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
