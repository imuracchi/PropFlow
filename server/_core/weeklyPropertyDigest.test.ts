import { describe, expect, it } from "vitest";
import { previousJstWeek } from "./weeklyPropertyDigest";

describe("previousJstWeek", () => {
  it("returns the previous Monday through Sunday in JST", () => {
    const range = previousJstWeek(new Date("2026-08-26T03:00:00.000Z"));
    expect(range.weekStart).toBe("2026-08-17");
    expect(range.start.toISOString()).toBe("2026-08-16T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-23T15:00:00.000Z");
  });

  it("keeps the same completed week on Monday JST", () => {
    const range = previousJstWeek(new Date("2026-08-24T00:00:00.000Z"));
    expect(range.weekStart).toBe("2026-08-17");
  });
});
