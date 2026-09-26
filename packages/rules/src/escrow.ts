import { apportion, clamp } from "./util";

/** Up to this share of the pot remaining after challenge purchases goes to
 * the claimant, scaled by grade. */
export const CLAIMANT_SHARE = 0.6;
/** Always goes to challengers, split by damage done. */
export const CHALLENGER_BASE_SHARE = 0.3;
/** Whatever's left (up to ~10%) is the patron's fee pool, earned back as a
 * partial refund scaled by how much the case moved the audience overall. */
export const PATRON_FEE_SHARE = 1 - CLAIMANT_SHARE - CHALLENGER_BASE_SHARE;

/** Cumulative audience movement (|interim-opening| + |final-interim|) at or
 * above this fully earns the patron's fee pool. */
export const PATRON_FULL_MOVEMENT_POINTS = 20;

export interface BoughtChallengeInput {
  id: string;
  authorId: string;
  /** 0-1: how much this challenge damaged the defense (1 - challengeFraction). */
  damage: number;
}

export interface EscrowInputs {
  /** Total cred a patron put in escrow when posting the bounty. */
  bountyAmount: number;
  /** Flat price paid per bought challenge, straight to its author, at
   * purchase time — separate from the pool split below. */
  challengePrice: number;
  boughtChallenges: readonly BoughtChallengeInput[];
  /** Claimant's final grade, 0-100. */
  grade: number;
  /** Sum of audience movement across both post-opening votes. */
  audienceMovement: number;
}

export interface ChallengerShare {
  challengeId: string;
  authorId: string;
  /** This challenge's cut of the flat per-challenge purchase price. */
  purchasePay: number;
  /** This challenge's cut of the shared challenger pool. */
  poolPay: number;
}

export interface EscrowResult {
  totalEscrow: number;
  /** Paid immediately to challengers at purchase time. */
  totalPurchasePay: number;
  /** Escrow remaining after purchases: what the claimant/challenger/patron
   * split is actually computed over. */
  remainingPot: number;
  /** Whatever the claimant and patron don't earn flows here. */
  challengerPool: number;
  claimantPayout: number;
  patronPayout: number;
  challengerShares: ChallengerShare[];
  /** claimantPayout + patronPayout + sum(challengerShares poolPay), should
   * equal remainingPot exactly (no cred created or destroyed). */
  totalPoolPaidOut: number;
}

export function resolveEscrow(inputs: EscrowInputs): EscrowResult {
  const totalPurchasePay = inputs.boughtChallenges.length * inputs.challengePrice;
  const remainingPot = Math.max(0, inputs.bountyAmount - totalPurchasePay);

  const claimantPotShare = Math.round(remainingPot * CLAIMANT_SHARE);
  const challengerBaseShare = Math.round(remainingPot * CHALLENGER_BASE_SHARE);
  const patronFeePool = remainingPot - claimantPotShare - challengerBaseShare;

  const claimantPayout = Math.round((claimantPotShare * clamp(inputs.grade, 0, 100)) / 100);
  const movementRatio = Math.min(1, inputs.audienceMovement / PATRON_FULL_MOVEMENT_POINTS);
  const patronPayout = Math.round(patronFeePool * movementRatio);

  const challengerPool =
    challengerBaseShare + (claimantPotShare - claimantPayout) + (patronFeePool - patronPayout);

  const weights = inputs.boughtChallenges.map((c) => c.damage);
  const poolShares = apportion(challengerPool, weights);

  const challengerShares: ChallengerShare[] = inputs.boughtChallenges.map((c, i) => ({
    challengeId: c.id,
    authorId: c.authorId,
    purchasePay: inputs.challengePrice,
    poolPay: poolShares[i]!,
  }));

  return {
    totalEscrow: inputs.bountyAmount,
    totalPurchasePay,
    remainingPot,
    challengerPool,
    claimantPayout,
    patronPayout,
    challengerShares,
    totalPoolPaidOut:
      claimantPayout + patronPayout + challengerShares.reduce((s, c) => s + c.poolPay, 0),
  };
}
