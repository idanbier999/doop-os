import { describe, it, expect } from "vitest";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "./api-key-hash";

describe("api-key-hash", () => {
  describe("generateApiKey", () => {
    it("returns a key starting with doop_", () => {
      const key = generateApiKey();
      expect(key.startsWith("doop_")).toBe(true);
    });

    it("returns a key of correct length (doop_ + 32 hex chars = 37)", () => {
      const key = generateApiKey();
      expect(key).toHaveLength(37);
    });

    it("generates unique keys", () => {
      const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
      expect(keys.size).toBe(10);
    });

    it("contains only valid hex chars after prefix", () => {
      const key = generateApiKey();
      const hex = key.slice(5);
      expect(hex).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("hashApiKey", () => {
    it("returns a 64-char hex string (SHA-256)", () => {
      const hash = hashApiKey("doop_abcdef1234567890abcdef12345678");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic", () => {
      const key = "doop_test1234567890abcdef12345678";
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("different keys produce different hashes", () => {
      const h1 = hashApiKey("doop_aaaa1234567890abcdef12345678");
      const h2 = hashApiKey("doop_bbbb1234567890abcdef12345678");
      expect(h1).not.toBe(h2);
    });
  });

  describe("apiKeyPrefix", () => {
    it("returns first 12 characters", () => {
      const key = "doop_abcdef1234567890abcdef12345678";
      expect(apiKeyPrefix(key)).toBe("doop_abcdef1");
    });

    it("includes the doop_ prefix", () => {
      const key = generateApiKey();
      expect(apiKeyPrefix(key).startsWith("doop_")).toBe(true);
    });
  });
});
