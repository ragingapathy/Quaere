import {
  challengeDamage,
  challengeFraction,
  isValidRoundSelection,
  rulingsCast,
  roundScore as rulesRoundScore,
  topVotedChallengeIds,
  trimmedMedian,
  type ScoredChallenge,
} from "@quaere/rules";
import { CLAIMANT_PAST_RECORD, DEFAULT_CLAIM, SEED_CHALLENGES } from "./seed";
import { JURORS } from "./constants";
import type { CertaintyStage, DemoChallenge, DemoState } from "./types";

export const STAGES = [
  "Bounty",
  "Claim",
  "Round 1 challenges",
  "Round 1 defense",
  "Round 1 vote",
  "Round 2 challenges",
  "Round 2 defense",
  "Final vote",
  "Verdict",
] as const;

const STORAGE_KEY = "quaere-demo-v1";

function emptyPoll() {
  return { votes: JURORS.map(() => 50), sealed: false };
}

export function fresh(): DemoState {
  return {
    stage: 0,
    maxStage: 0,
    view: "play",
    bounty: { topic: "AI and the cost of living", amount: 1000, posted: false },
    patron: { name: "Atom", balance: 2400 },
    claimantName: "sierra",
    claim: { original: DEFAULT_CLAIM, current: DEFAULT_CLAIM, history: [] },
    draft: { opening: 55, interim: 55, final: 55 },
    cert: { opening: null, interim: null, final: null },
    polls: { opening: emptyPoll(), interim: emptyPoll(), final: emptyPoll() },
    challenges: SEED_CHALLENGES.map((c) => ({ ...c, resp: { ...c.resp }, tally: { ...c.tally } })),
    selection: { 1: [], 2: [] },
    revealed: false,
    priorCases: [],
    newChallengeDraft: { text: "", type: "question", hidden: false },
  };
}

export function load(): DemoState {
  if (typeof window === "undefined") return fresh();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as DemoState;
    if (!parsed || !parsed.polls) return fresh();
    return parsed;
  } catch {
    return fresh();
  }
}

export function save(state: DemoState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be unavailable (private mode, quota); the demo just
    // won't persist across reloads, which is fine.
  }
}

export function pollMedian(state: DemoState, stage: CertaintyStage): number | null {
  const poll = state.polls[stage];
  return poll.sealed ? trimmedMedian(poll.votes) : null;
}

export function openChallenges(state: DemoState): DemoChallenge[] {
  return state.challenges.filter((c) => c.round === null);
}

export function inRound(state: DemoState, round: 1 | 2): DemoChallenge[] {
  return state.challenges.filter((c) => c.round === round);
}

export function topOpenIds(state: DemoState): string[] {
  return topVotedChallengeIds(openChallenges(state).map((c) => ({ id: c.id, upvotes: c.upvotes })));
}

export function isValidSelection(state: DemoState, round: 1 | 2, perRound: number): boolean {
  return isValidRoundSelection(
    state.selection[round],
    openChallenges(state).map((c) => ({ id: c.id, upvotes: c.upvotes })),
    perRound,
  );
}

export function fractionOf(c: DemoChallenge): number {
  return challengeFraction(c.tally);
}

export function damageOf(c: DemoChallenge): number {
  return challengeDamage(c.tally);
}

export function rulingsCastOn(c: DemoChallenge): number {
  return rulingsCast(c.tally);
}

export function roundScoreOf(challenges: DemoChallenge[]): number {
  const scored: ScoredChallenge[] = challenges.map((c) => ({
    id: c.id,
    authorId: c.author,
    type: c.type,
    tally: c.tally,
  }));
  return rulesRoundScore(scored);
}

/** Mirrors the reference prototype's completeness gate: every named juror
 * has to rule before a round can close, and (new, per the Decision Log) a
 * narrowing response also needs its refinement-vs-retreat ruling before
 * it counts as answered. */
export function responseComplete(c: DemoChallenge, currentClaim: string): boolean {
  if (rulingsCastOn(c) !== JURORS.length) return false;
  const r = c.resp;
  if (c.type === "question") return r.text.trim().length > 0;
  if (r.mode === "refute") return r.source.trim().length > 0;
  if (r.mode === "narrow") {
    const narrowed = r.narrowed.trim();
    return narrowed.length > 0 && narrowed !== currentClaim.trim() && c.narrowingRuling !== null;
  }
  return r.mode === "concede";
}

export function wasNarrowed(state: DemoState): boolean {
  return state.claim.history.length > 0;
}

export function wasRetreat(state: DemoState): boolean {
  return state.challenges.some((c) => c.narrowingRuling === "retreat");
}

export { CLAIMANT_PAST_RECORD };
