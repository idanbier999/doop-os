import { describe, it, expect } from "vitest";

describe("Smoke test", () => {
  it("vitest is working", () => {
    expect(1 + 1).toBe(2);
  });

  it("environment variables are set", () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://test.supabase.co");
    expect(process.env.SUPABASE_JWT_SECRET).toBeDefined();
  });
});
