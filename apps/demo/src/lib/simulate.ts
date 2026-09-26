import { inRound, pollMedian, roundScoreOf } from "./state";
import { JURORS } from "./constants";
import type { CertaintyStage, DemoChallenge, DemoState } from "./types";

function gauss(): number {
  let u = 0;
  let v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

/** Simulated jurors react to how well the last round was defended, not
 * purely at random — this is a UX convenience for solo playtesting, not a
 * game rule, so it lives outside @quaere/rules. */
export function simulateVotes(state: DemoState, stage: CertaintyStage): number[] {
  let base: number;
  if (stage === "opening") {
    base = 38 + Math.random() * 20;
  } else {
    const prevStage: CertaintyStage = stage === "interim" ? "opening" : "interim";
    const round: 1 | 2 = stage === "interim" ? 1 : 2;
    const prev = pollMedian(state, prevStage) ?? 50;
    const bump = state.claim.history.some((h) => h.round === round) ? 4 : 0;
    base = prev + (roundScoreOf(inRound(state, round)) - 50) / 3 + bump;
  }
  return JURORS.map(() => Math.round(clamp(base + gauss() * 12, 0, 100)));
}

export function simulateTallyFor(c: DemoChallenge) {
  const J = JURORS.length;
  if (c.type === "question") {
    const q = Math.min(1, c.resp.text.trim().length / 160);
    const answered = Math.round(J * q * (0.45 + Math.random() * 0.45));
    const partial = Math.round((J - answered) * Math.min(1, q + 0.2) * Math.random());
    return { answered, partial, dodged: J - answered - partial };
  }
  const b =
    c.resp.mode === "refute"
      ? c.resp.source.trim()
        ? 0.5 + Math.min(0.3, c.resp.source.length / 200)
        : 0.15
      : c.resp.mode === "narrow"
        ? 0.62
        : c.resp.mode === "concede"
          ? 0.78
          : 0.05;
  const convincing = Math.round(clamp(J * b * (0.75 + Math.random() * 0.5), 0, J));
  return { convincing, notConvincing: J - convincing };
}
