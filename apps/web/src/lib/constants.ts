/**
 * App-level economic parameters. These are placeholders pending
 * playtesting, distinct from the settled game rules in @quaere/rules — the
 * Decision Log fixes challenge count and leaves price/onboarding open.
 */

/** Decision Log: "Challenges per round is fixed at 5 for the initial build." */
export const CHALLENGES_PER_ROUND = 5;

/** Flat cred paid to a challenge's author the moment it's bought, straight
 * from escrow (Design Bible, Section 3). Carried over from the reference
 * prototype's placeholder value pending a real number. */
export const CHALLENGE_PRICE = 20;

/** Starting cred grant on registration — this is the only place cred is
 * ever created; every other movement in the game just reshuffles cred that
 * already exists (see lib/economy.ts). Not specified in the design docs
 * beyond "self-reported and encouraged"-style placeholders elsewhere; 1500
 * is a placeholder pending playtesting. */
export const STARTING_GRANT = 1500;
