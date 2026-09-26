import { describe, expect, it } from "vitest";
import { resolveEscrow } from "../src/escrow.js";

describe("resolveEscrow", () => {
  it("never creates or destroys cred: pool payouts sum to the remaining pot", () => {
    const result = resolveEscrow({
      bountyAmount: 1000,
      challengePrice: 20,
      boughtChallenges: [
        { id: "c1", authorId: "june", damage: 0.9 },
        { id: "c2", authorId: "feld", damage: 0.4 },
        { id: "q1", authorId: "mira", damage: 0.1 },
      ],
      grade: 71,
      audienceMovement: 15,
    });
    expect(result.totalPurchasePay).toBe(60);
    expect(result.remainingPot).toBe(940);
    expect(result.totalPoolPaidOut).toBe(result.remainingPot);
  });

  it("pays challengers by relative damage, most-damaging first", () => {
    const result = resolveEscrow({
      bountyAmount: 1000,
      challengePrice: 20,
      boughtChallenges: [
        { id: "c1", authorId: "a", damage: 0.8 },
        { id: "c2", authorId: "b", damage: 0.2 },
      ],
      grade: 50,
      audienceMovement: 20,
    });
    const a = result.challengerShares.find((s) => s.authorId === "a")!;
    const b = result.challengerShares.find((s) => s.authorId === "b")!;
    expect(a.poolPay).toBeGreaterThan(b.poolPay);
  });

  it("never pays escrow beyond what's left after challenge purchases", () => {
    const result = resolveEscrow({
      bountyAmount: 50,
      challengePrice: 20,
      boughtChallenges: [
        { id: "c1", authorId: "a", damage: 1 },
        { id: "c2", authorId: "b", damage: 1 },
        { id: "c3", authorId: "c", damage: 1 },
      ],
      grade: 100,
      audienceMovement: 20,
    });
    // 3 * 20 = 60 > 50 bounty: remaining pot floors at 0.
    expect(result.remainingPot).toBe(0);
    expect(result.claimantPayout).toBe(0);
    expect(result.patronPayout).toBe(0);
  });

  it("caps the patron's fee by movement, full payout only at 20+ points of movement", () => {
    const full = resolveEscrow({
      bountyAmount: 1000,
      challengePrice: 20,
      boughtChallenges: [{ id: "c1", authorId: "a", damage: 0.5 }],
      grade: 0,
      audienceMovement: 20,
    });
    const half = resolveEscrow({
      bountyAmount: 1000,
      challengePrice: 20,
      boughtChallenges: [{ id: "c1", authorId: "a", damage: 0.5 }],
      grade: 0,
      audienceMovement: 10,
    });
    expect(half.patronPayout).toBeLessThan(full.patronPayout);
  });
});
