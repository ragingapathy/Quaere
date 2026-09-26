import { calibration } from "./calibration";
import { type BoughtChallengeInput, type EscrowResult, resolveEscrow } from "./escrow";
import { applyRetreatCap, grade, type GradeBreakdown, swingScore } from "./grade";
import type { Verdict } from "./types";
import { describeSwing, verdictOf, VERDICT_COPY } from "./verdict";

export interface ResolveCaseInputs {
  bountyAmount: number;
  challengePrice: number;
  boughtChallenges: readonly BoughtChallengeInput[];
  openingCertainty: { claimant: number; audience: number };
  interimCertainty: { claimant: number; audience: number };
  finalCertainty: { claimant: number; audience: number };
  round1Score: number;
  round2Score: number;
  wasNarrowed: boolean;
  wasRetreat: boolean;
}

export interface ResolvedCase {
  verdict: Exclude<Verdict, "Forfeited">;
  verdictCopy: string;
  swingDescription: string;
  grade: GradeBreakdown;
  escrow: EscrowResult;
}

/**
 * The single entry point that turns a finished case's raw inputs into a
 * verdict, grade, and payout ledger. Kept as one function so the real app
 * and the single-user demo can never quietly compute this two different
 * ways.
 */
export function resolveCase(inputs: ResolveCaseInputs): ResolvedCase {
  const verdict = verdictOf({
    openingCertainty: inputs.openingCertainty.audience,
    finalCertainty: inputs.finalCertainty.audience,
    wasNarrowed: inputs.wasNarrowed,
  });

  const rawSwing = swingScore(inputs.openingCertainty.audience, inputs.finalCertainty.audience);
  const swingComponent = applyRetreatCap(rawSwing, inputs.wasRetreat);

  const defenseComponent = (inputs.round1Score + inputs.round2Score) / 2;

  const calibrationComponent =
    (calibration(inputs.openingCertainty.claimant, inputs.openingCertainty.audience) +
      calibration(inputs.interimCertainty.claimant, inputs.interimCertainty.audience) +
      calibration(inputs.finalCertainty.claimant, inputs.finalCertainty.audience)) /
    3;

  const g = grade({
    swing: swingComponent,
    defense: defenseComponent,
    calibration: calibrationComponent,
  });

  const audienceMovement =
    Math.abs(inputs.interimCertainty.audience - inputs.openingCertainty.audience) +
    Math.abs(inputs.finalCertainty.audience - inputs.interimCertainty.audience);

  const escrow = resolveEscrow({
    bountyAmount: inputs.bountyAmount,
    challengePrice: inputs.challengePrice,
    boughtChallenges: inputs.boughtChallenges,
    grade: g.grade,
    audienceMovement,
  });

  return {
    verdict,
    verdictCopy: VERDICT_COPY[verdict],
    swingDescription: describeSwing(
      inputs.openingCertainty.audience,
      inputs.finalCertainty.audience,
      verdict,
    ),
    grade: g,
    escrow,
  };
}
