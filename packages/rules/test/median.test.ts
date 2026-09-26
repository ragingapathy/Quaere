import { describe, expect, it } from "vitest";
import { trimmedMedian } from "../src/median.js";

describe("trimmedMedian", () => {
  it("drops the high and low vote once there are at least 5 votes", () => {
    // sorted: 10,40,50,60,90 -> trimmed: 40,50,60 -> median 50
    expect(trimmedMedian([90, 10, 50, 40, 60])).toBe(50);
  });

  it("does not trim below 5 votes", () => {
    // sorted: 10,50,90 -> median 50 (untrimmed, since trimming would leave 1)
    expect(trimmedMedian([90, 10, 50])).toBe(50);
  });

  it("averages the two middle votes on an even count", () => {
    expect(trimmedMedian([10, 20])).toBe(15);
  });

  it("handles an even trimmed count at 6+ votes", () => {
    // sorted: 0,20,40,60,80,100 -> trimmed: 20,40,60,80 -> median 50
    expect(trimmedMedian([100, 0, 40, 60, 20, 80])).toBe(50);
  });

  it("throws on an empty ballot", () => {
    expect(() => trimmedMedian([])).toThrow();
  });
});
