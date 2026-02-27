import { describe, it, expect } from "vitest";
import { toExportEntries } from "./export";

// Helper to build a minimal activity_log row matching the Tables<"activity_log"> shape.
function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "entry-1",
    action: "task_created",
    agent_id: "agent-1",
    created_at: "2026-02-27T12:00:00Z",
    details: null,
    user_id: "user-1",
    workspace_id: "ws-1",
    agents: { name: "TestAgent" },
    ...overrides,
  } as Parameters<typeof toExportEntries>[0][number];
}

describe("toExportEntries", () => {
  it("returns an empty array for empty input", () => {
    expect(toExportEntries([])).toEqual([]);
  });

  it("maps created_at to an ISO timestamp", () => {
    const entries = toExportEntries([
      makeEntry({ created_at: "2026-02-27T12:00:00Z" }),
    ]);
    expect(entries[0].timestamp).toBe("2026-02-27T12:00:00.000Z");
  });

  it('returns "" timestamp when created_at is null', () => {
    const entries = toExportEntries([makeEntry({ created_at: null })]);
    expect(entries[0].timestamp).toBe("");
  });

  it("uses agent name from joined agents object", () => {
    const entries = toExportEntries([
      makeEntry({ agents: { name: "MyAgent" } }),
    ]);
    expect(entries[0].agent_name).toBe("MyAgent");
  });

  it('falls back to "System" when agents is null', () => {
    const entries = toExportEntries([makeEntry({ agents: null })]);
    expect(entries[0].agent_name).toBe("System");
  });

  it('falls back to "System" when agents is undefined', () => {
    const entries = toExportEntries([makeEntry({ agents: undefined })]);
    expect(entries[0].agent_name).toBe("System");
  });

  // --- flattenDetails coverage (tested indirectly) ---

  it("handles null details as empty string", () => {
    const entries = toExportEntries([makeEntry({ details: null })]);
    expect(entries[0].details).toBe("");
  });

  it("handles string details", () => {
    const entries = toExportEntries([makeEntry({ details: "some detail" })]);
    expect(entries[0].details).toBe("some detail");
  });

  it("handles number details", () => {
    const entries = toExportEntries([makeEntry({ details: 42 })]);
    expect(entries[0].details).toBe("42");
  });

  it("handles boolean details", () => {
    const entries = toExportEntries([makeEntry({ details: true })]);
    expect(entries[0].details).toBe("true");
  });

  it("handles array details with JSON.stringify", () => {
    const entries = toExportEntries([
      makeEntry({ details: [1, "two", 3] }),
    ]);
    expect(entries[0].details).toBe(JSON.stringify([1, "two", 3]));
  });

  it('handles object details as "key=value; key=value"', () => {
    const entries = toExportEntries([
      makeEntry({ details: { foo: "bar", count: 5 } }),
    ]);
    expect(entries[0].details).toBe("foo=bar; count=5");
  });

  it('handles object with null values as "key="', () => {
    const entries = toExportEntries([
      makeEntry({ details: { empty: null } }),
    ]);
    expect(entries[0].details).toBe("empty=");
  });

  it("handles nested object values with JSON stringified value", () => {
    const entries = toExportEntries([
      makeEntry({ details: { nested: { a: 1 } } }),
    ]);
    expect(entries[0].details).toBe(`nested=${JSON.stringify({ a: 1 })}`);
  });

  it("maps user_id to user field", () => {
    const entries = toExportEntries([makeEntry({ user_id: "u-123" })]);
    expect(entries[0].user).toBe("u-123");
  });

  it("maps null user_id to empty string", () => {
    const entries = toExportEntries([makeEntry({ user_id: null })]);
    expect(entries[0].user).toBe("");
  });
});
