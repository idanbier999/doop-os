import { describe, it, expect } from "vitest";
import { CATEGORY_ACTIONS, ALL_KNOWN_ACTIONS } from "./activity-categories";

describe("CATEGORY_ACTIONS", () => {
  it("has the expected category keys", () => {
    expect(Object.keys(CATEGORY_ACTIONS)).toEqual(
      expect.arrayContaining(["agent_lifecycle", "task_events", "problems", "settings"])
    );
    expect(Object.keys(CATEGORY_ACTIONS)).toHaveLength(4);
  });

  it("each category has a non-empty array of actions", () => {
    for (const [category, actions] of Object.entries(CATEGORY_ACTIONS)) {
      expect(Array.isArray(actions)).toBe(true);
      expect(actions.length).toBeGreaterThan(0);
    }
  });
});

describe("ALL_KNOWN_ACTIONS", () => {
  it("contains all actions from every category, flattened", () => {
    const expected = Object.values(CATEGORY_ACTIONS).flat();
    expect(ALL_KNOWN_ACTIONS).toEqual(expected);
    expect(ALL_KNOWN_ACTIONS).toHaveLength(expected.length);
  });

  it("has no duplicate actions across categories", () => {
    const unique = new Set(ALL_KNOWN_ACTIONS);
    expect(unique.size).toBe(ALL_KNOWN_ACTIONS.length);
  });
});
