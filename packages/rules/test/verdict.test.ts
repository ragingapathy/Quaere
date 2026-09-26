import { describe, expect, it } from "vitest";
import { describeSwing, verdictOf } from "../src/verdict.js";

// Cross-checked against the four archived cases on the "AI and the cost of
// living" Record in the reference mockup (Record r1), which is the closest
// thing to a fixed oracle for this formula.
describe("verdictOf", () => {
  it("reads as Amended when narrowed, even with a small positive swing", () => {
    expect(
      verdictOf({ openingCertainty: 38, finalCertainty: 44, wasNarrowed: true }),
    ).toBe("Amended");
  });

  it("reads as Upheld on a strong positive swing with no narrowing", () => {
    expect(
      verdictOf({ openingCertainty: 44, finalCertainty: 61, wasNarrowed: false }),
    ).toBe("Upheld");
  });

  it("reads as Unmoved when the swing is small and nothing was narrowed", () => {
    expect(
      verdictOf({ openingCertainty: 59, finalCertainty: 60, wasNarrowed: false }),
    ).toBe("Unmoved");
  });

  it("reads as Overturned on a strong negative swing", () => {
    expect(
      verdictOf({ openingCertainty: 60, finalCertainty: 52, wasNarrowed: false }),
    ).toBe("Overturned");
  });

  it("Overturned outranks narrowing", () => {
    expect(
      verdictOf({ openingCertainty: 60, finalCertainty: 52, wasNarrowed: true }),
    ).toBe("Overturned");
  });
});

describe("describeSwing", () => {
  it("names the narrowed claim once the claim changed", () => {
    expect(describeSwing(38, 44, "Amended")).toBe("Audience moved toward the narrowed claim, +6");
  });

  it("reads as barely moved under 5 points either way", () => {
    expect(describeSwing(59, 60, "Unmoved")).toBe("Audience barely moved, +1");
  });

  it("reads as moved against the claim on negative swing", () => {
    expect(describeSwing(60, 52, "Overturned")).toBe("Audience moved against the claim, -8");
  });
});
