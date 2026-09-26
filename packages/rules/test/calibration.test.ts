import { describe, expect, it } from "vitest";
import { calibration } from "../src/calibration.js";

describe("calibration", () => {
  it("scores 100 for a perfect match", () => {
    expect(calibration(50, 50)).toBe(100);
  });

  it("loses 4 points per point of difference", () => {
    expect(calibration(40, 50)).toBe(60);
    expect(calibration(60, 50)).toBe(60);
  });

  it("floors at 0 rather than going negative", () => {
    expect(calibration(10, 90)).toBe(0);
  });

  it("scores 0 when either side hasn't committed yet", () => {
    expect(calibration(null, 50)).toBe(0);
    expect(calibration(50, null)).toBe(0);
  });
});
