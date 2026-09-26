/** Same placeholders as the multiplayer app (apps/web/src/lib/constants.ts) —
 * duplicated rather than shared, since these are app-level economic knobs,
 * not settled game rules. Keep the two in sync by hand until there's a
 * reason to factor them out. */
export const CHALLENGES_PER_ROUND = 5;
export const CHALLENGE_PRICE = 20;

/** The demo has no real audience, so certainty is cast by a fixed panel of
 * named jurors you play yourself (or simulate) — ported from the reference
 * prototype's juror panel. */
export const JURORS = [
  "mira",
  "kaito",
  "atlas_9",
  "soph",
  "dr_lumen",
  "june",
  "feld",
  "n_01",
  "rhea",
] as const;
