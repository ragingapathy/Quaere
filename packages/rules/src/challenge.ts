import { isQuestionTally, type JuryTally, type ScoredChallenge } from "./types";

/** Total number of jurors who have ruled on a challenge so far. */
export function rulingsCast(tally: JuryTally): number {
  return isQuestionTally(tally)
    ? tally.answered + tally.partial + tally.dodged
    : tally.convincing + tally.notConvincing;
}

/**
 * How well a challenge was met, as a fraction in [0, 1] of the jurors who
 * have actually ruled on it (not a fixed juror count, since audience size
 * is not fixed — Decision Log). A question counts a partial answer as half
 * credit; a counterfact counts only a "convincing" ruling. Unruled (0
 * rulings cast) reads as 0, matching the mockup's behavior for a fresh
 * challenge.
 */
export function challengeFraction(tally: JuryTally): number {
  const total = rulingsCast(tally);
  if (total === 0) return 0;
  return isQuestionTally(tally)
    ? (tally.answered + 0.5 * tally.partial) / total
    : tally.convincing / total;
}

/** The defense score (0-100) for one round: the average challenge fraction
 * across every challenge bought that round. An empty round scores 0. */
export function roundScore(challenges: readonly ScoredChallenge[]): number {
  if (challenges.length === 0) return 0;
  const sum = challenges.reduce((s, c) => s + challengeFraction(c.tally), 0);
  return (sum / challenges.length) * 100;
}

/** How much a challenge damaged the defense: the complement of how well it
 * was met. Used to weight the challenger pool payout. */
export function challengeDamage(tally: JuryTally): number {
  return 1 - challengeFraction(tally);
}
