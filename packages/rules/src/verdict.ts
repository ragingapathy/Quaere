import type { Verdict } from "./types";

/** Swing of 5 points or more is treated as having actually moved the room;
 * anything smaller reads as Unmoved even if technically nonzero. */
export const OVERTURNED_THRESHOLD = -5;
export const UPHELD_THRESHOLD = 5;

/**
 * Determines the verdict from opening-to-final swing and whether the claim
 * was narrowed at any point. Forfeiture is a separate, out-of-band outcome
 * reached through the response backstop, not through this function (Design
 * Bible, Section 3) — callers should short-circuit to "Forfeited" themselves
 * before ever computing a swing-based verdict.
 *
 * Overturned is checked first: a claim that lost the room reads as
 * Overturned even if it was also narrowed along the way. Otherwise, having
 * narrowed at any point caps the verdict at Amended — it can never read as
 * Upheld, no matter how strong the later swing (Decision Log).
 */
export function verdictOf(input: {
  openingCertainty: number;
  finalCertainty: number;
  wasNarrowed: boolean;
}): Exclude<Verdict, "Forfeited"> {
  const swing = input.finalCertainty - input.openingCertainty;
  if (swing <= OVERTURNED_THRESHOLD) return "Overturned";
  if (input.wasNarrowed) return "Amended";
  if (swing >= UPHELD_THRESHOLD) return "Upheld";
  return "Unmoved";
}

export const VERDICT_COPY: Record<Exclude<Verdict, "Forfeited">, string> = {
  Upheld: "The defense moved the audience toward the claim.",
  Amended: "The claim was narrowed under challenge, and the narrower version held.",
  Overturned: "The challenges moved the audience away from the claim.",
  Unmoved: "The audience ended about where it started. Neither side moved the room.",
};

/**
 * The mechanically-generated, plain-language description of the swing that
 * must accompany every verdict (Design Bible, Section 3 and 10: a case
 * summary is never authored by a person). Ported from the v2 prototype's
 * `swingPhrase`.
 */
export function describeSwing(
  openingCertainty: number,
  finalCertainty: number,
  verdict: Exclude<Verdict, "Forfeited">,
): string {
  const delta = Math.round(finalCertainty - openingCertainty);
  const claimWord = verdict === "Amended" ? "the narrowed claim" : "the claim";
  if (Math.abs(delta) < 5) {
    return `Audience barely moved, ${delta >= 0 ? "+" : ""}${delta}`;
  }
  return delta > 0
    ? `Audience moved toward ${claimWord}, +${delta}`
    : `Audience moved against ${claimWord}, ${delta}`;
}
