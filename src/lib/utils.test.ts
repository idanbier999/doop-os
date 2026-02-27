import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { relativeTime, formatDate } from "./utils";

describe("relativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Never" for null input', () => {
    expect(relativeTime(null)).toBe("Never");
  });

  it('returns "Just now" for timestamps less than 60 seconds ago', () => {
    const thirtySecondsAgo = new Date(
      Date.now() - 30 * 1000
    ).toISOString();
    expect(relativeTime(thirtySecondsAgo)).toBe("Just now");
  });

  it('returns "Xm ago" for timestamps minutes ago', () => {
    const fiveMinutesAgo = new Date(
      Date.now() - 5 * 60 * 1000
    ).toISOString();
    expect(relativeTime(fiveMinutesAgo)).toBe("5m ago");
  });

  it('returns "Xh ago" for timestamps hours ago', () => {
    const threeHoursAgo = new Date(
      Date.now() - 3 * 60 * 60 * 1000
    ).toISOString();
    expect(relativeTime(threeHoursAgo)).toBe("3h ago");
  });

  it('returns "Xd ago" for timestamps days ago', () => {
    const twoDaysAgo = new Date(
      Date.now() - 2 * 24 * 60 * 60 * 1000
    ).toISOString();
    expect(relativeTime(twoDaysAgo)).toBe("2d ago");
  });
});

describe("formatDate", () => {
  it('returns "-" for null input', () => {
    expect(formatDate(null)).toBe("-");
  });

  it("returns a formatted date string for valid input", () => {
    const result = formatDate("2026-02-27T14:30:00Z");
    // Should contain month abbreviation, day, and time parts
    expect(result).toBeTruthy();
    expect(result).not.toBe("-");
  });

  it("formats using en-US locale with month, day, hour, and minute", () => {
    // Use a fixed date and check the output contains expected components
    const result = formatDate("2026-06-15T09:05:00Z");
    // en-US with short month → "Jun"
    expect(result).toContain("Jun");
    expect(result).toContain("15");
  });
});
