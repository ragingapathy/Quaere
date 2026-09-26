import { describe, expect, it } from "vitest";
import { applyRetreatCap, grade, RETREAT_SWING_CAP, swingScore } from "../src/grade.js";

describe("swingScore", () => {
  it("scores exactly 50 at zero swing", () => {
    expect(swingScore(50, 50)).toBe(50);
  });

  it("earns full marks at +20 points of swing", () => {
    expect(swingScore(30, 50)).toBe(100);
  });

  it("earns zero at -20 points of swing", () => {
    expect(swingScore(50, 30)).toBe(0);
  });

  it("clamps beyond +/-20", () => {
    expect(swingScore(10, 90)).toBe(100);
    expect(swingScore(90, 10)).toBe(0);
  });
});

describe("applyRetreatCap", () => {
  it("leaves a refinement's swing score untouched", () => {
    expect(applyRetreatCap(90, false)).toBe(90);
  });

  it("caps a retreat at the same value as a claim that moved nobody", () => {
    expect(applyRetreatCap(90, true)).toBe(RETREAT_SWING_CAP);
  });

  it("never raises a low score", () => {
    expect(applyRetreatCap(20, true)).toBe(20);
  });
});

describe("grade", () => {
  it("weights swing 45%, defense 40%, calibration 15%", () => {
    const g = grade({ swing: 100, defense: 100, calibration: 100 });
    expect(g.grade).toBe(100);
  });

  it("computes a mixed case", () => {
    const g = grade({ swing: 80, defense: 60, calibration: 40 });
    expect(g.grade).toBeCloseTo(0.45 * 80 + 0.4 * 60 + 0.15 * 40);
  });
});
