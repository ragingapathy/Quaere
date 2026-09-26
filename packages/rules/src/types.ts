/**
 * Core vocabulary shared by every Quaere surface (the real multiplayer app
 * and the single-user demo). Names follow the functional role names from the
 * Design Bible: patron, claimant, audience, the Record. Skins may relabel
 * these in presentation; the rules never do.
 */

export type ChallengeType = "question" | "counterfact";

/** How a claimant chose to respond to a counterfact. */
export type CounterfactMove = "refute" | "narrow" | "concede";

/** A question is rated by the jury as answered, partial, or dodged. */
export interface QuestionTally {
  answered: number;
  partial: number;
  dodged: number;
}

/** A counterfact response is rated fair-and-convincing, or not. */
export interface CounterfactTally {
  convincing: number;
  notConvincing: number;
}

export type JuryTally = QuestionTally | CounterfactTally;

export function isQuestionTally(t: JuryTally): t is QuestionTally {
  return "answered" in t;
}

/** The three points at which the claimant commits a certainty. */
export type CertaintyStage = "opening" | "interim" | "final";

/**
 * A single juror poll. Audience size is not fixed (Decision Log): rounds run
 * against a minimum quorum rather than a fixed juror count, so `votes` can be
 * any length at or above whatever quorum the deployment enforces.
 */
export interface Poll {
  votes: number[];
  sealed: boolean;
}

export type Verdict = "Upheld" | "Amended" | "Unmoved" | "Overturned" | "Forfeited";

export const VERDICTS: readonly Verdict[] = [
  "Upheld",
  "Amended",
  "Unmoved",
  "Overturned",
  "Forfeited",
];

/** A bought challenge as scored input to the grade/escrow formulas. */
export interface ScoredChallenge {
  id: string;
  authorId: string;
  type: ChallengeType;
  tally: JuryTally;
}

/** Ruling the audience makes on a claimant's narrowing of the claim. */
export type NarrowingRuling = "refinement" | "retreat";

export interface NarrowingEvent {
  round: 1 | 2;
  ruling: NarrowingRuling;
}
