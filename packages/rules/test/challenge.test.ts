import { describe, expect, it } from "vitest";
import { challengeDamage, challengeFraction, roundScore } from "../src/challenge.js";
import type { ScoredChallenge } from "../src/types.js";

describe("challengeFraction", () => {
  it("counts a partial question answer as half credit", () => {
    expect(challengeFraction({ answered: 4, partial: 2, dodged: 2 })).toBeCloseTo(5 / 8);
  });

  it("counts only convincing rulings for a counterfact", () => {
    expect(challengeFraction({ convincing: 3, notConvincing: 5 })).toBe(3 / 8);
  });

  it("reads as 0 before any juror has ruled", () => {
    expect(challengeFraction({ answered: 0, partial: 0, dodged: 0 })).toBe(0);
  });

  it("is the complement of damage", () => {
    const tally = { convincing: 6, notConvincing: 2 };
    expect(challengeDamage(tally)).toBeCloseTo(1 - challengeFraction(tally));
  });
});

describe("roundScore", () => {
  it("averages fraction across every challenge in the round", () => {
    const challenges: ScoredChallenge[] = [
      { id: "q1", authorId: "a", type: "question", tally: { answered: 8, partial: 0, dodged: 0 } },
      {
        id: "c1",
        authorId: "b",
        type: "counterfact",
        tally: { convincing: 0, notConvincing: 8 },
      },
    ];
    // (1.0 + 0.0) / 2 * 100
    expect(roundScore(challenges)).toBe(50);
  });

  it("scores an empty round 0", () => {
    expect(roundScore([])).toBe(0);
  });
});
