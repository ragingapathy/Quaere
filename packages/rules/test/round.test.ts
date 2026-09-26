import { describe, expect, it } from "vitest";
import { isValidRoundSelection, topVotedChallengeIds } from "../src/round.js";

const open = [
  { id: "q1", upvotes: 14 },
  { id: "c1", upvotes: 11 },
  { id: "q2", upvotes: 9 },
  { id: "c2", upvotes: 7 },
];

describe("topVotedChallengeIds", () => {
  it("returns every tied leader", () => {
    expect(topVotedChallengeIds(open)).toEqual(["q1"]);
    expect(topVotedChallengeIds([...open, { id: "q3", upvotes: 14 }])).toEqual(["q1", "q3"]);
  });
});

describe("isValidRoundSelection", () => {
  it("rejects a selection missing the top-voted challenge", () => {
    expect(isValidRoundSelection(["c1", "q2", "c2"], open, 3)).toBe(false);
  });

  it("rejects the wrong count even if the top challenge is included", () => {
    expect(isValidRoundSelection(["q1", "c1"], open, 3)).toBe(false);
  });

  it("accepts a full, top-inclusive selection", () => {
    expect(isValidRoundSelection(["q1", "c1", "q2"], open, 3)).toBe(true);
  });
});
