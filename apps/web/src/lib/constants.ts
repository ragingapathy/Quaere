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

/**
 * Tipping anti-abuse knobs. Registration mints cred; tipping is the only
 * place cred moves between two wallets with no game mechanic in between, so
 * it's gated by lib/tipping.ts rather than left open. No burn/fee on top of
 * these — a tip is still 1:1, cred in equals cred out, per the Decision
 * Log's "a tip moves cred out of the tipper's own current balance; it mints
 * nothing." All three numbers are placeholders pending playtesting.
 */
export const MAX_TIP_AMOUNT = 500;
export const TIP_DAILY_CAP_PER_SENDER = 1000;
export const TIP_LIFETIME_CAP_PER_PAIR = 1000;
