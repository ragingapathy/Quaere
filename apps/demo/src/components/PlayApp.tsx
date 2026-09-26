"use client";

import { useEffect, useRef, useState } from "react";
import type { CounterfactMove, NarrowingRuling } from "@quaere/rules";
import { resolveCase } from "@quaere/rules";
import { CHALLENGE_PRICE } from "@/lib/constants";
import { fresh, inRound, load, pollMedian, save, damageOf, roundScoreOf, wasNarrowed, wasRetreat } from "@/lib/state";
import { simulateTallyFor, simulateVotes } from "@/lib/simulate";
import type { CertaintyStage, DemoChallenge, DemoState, Handlers } from "@/lib/types";
import { StepNav } from "./StepNav";
import { BountyStage, ClaimStage, DefenseStage, MarketStage, RecordView, VerdictStage, VoteStage } from "./Stages";

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

function advanceState(s: DemoState): DemoState {
  const stage = s.stage + 1;
  return { ...s, stage, maxStage: Math.max(s.maxStage, stage), view: "play" };
}

function updateChallenge(
  s: DemoState,
  id: string,
  updater: (c: DemoChallenge) => DemoChallenge,
): DemoState {
  return { ...s, challenges: s.challenges.map((c) => (c.id === id ? updater(c) : c)) };
}

const STAGE_INDEX: Record<number, "bounty" | "claim" | "market1" | "defense1" | "vote-interim" | "market2" | "defense2" | "vote-final" | "verdict"> = {
  0: "bounty",
  1: "claim",
  2: "market1",
  3: "defense1",
  4: "vote-interim",
  5: "market2",
  6: "defense2",
  7: "vote-final",
  8: "verdict",
};

export default function PlayApp() {
  const [state, setState] = useState<DemoState>(() => fresh());
  const loadedRef = useRef(false);

  useEffect(() => {
    setState(load());
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    save(state);
  }, [state]);

  const h: Handlers = {
    setTopic: (topic) => setState((s) => ({ ...s, bounty: { ...s.bounty, topic } })),
    setAmount: (amount) => setState((s) => ({ ...s, bounty: { ...s.bounty, amount } })),
    postBounty: () =>
      setState((s) =>
        advanceState({
          ...s,
          bounty: {
            ...s.bounty,
            amount: clamp(s.bounty.amount || 1000, 1, s.patron.balance),
            posted: true,
          },
        }),
      ),

    setClaimText: (text) =>
      setState((s) => (s.cert.opening != null ? s : { ...s, claim: { ...s.claim, current: text } })),

    lockCertainty: (stage) =>
      setState((s) => {
        if (s.cert[stage] != null) return s;
        let claim = s.claim;
        if (stage === "opening") {
          const t = s.claim.current.trim();
          if (!t) return s;
          claim = { ...s.claim, original: t, current: t };
        }
        return { ...s, claim, cert: { ...s.cert, [stage]: s.draft[stage] } };
      }),

    setDraft: (stage, value) => setState((s) => ({ ...s, draft: { ...s.draft, [stage]: value } })),

    setVote: (stage, idx, value) =>
      setState((s) => {
        const votes = [...s.polls[stage].votes];
        votes[idx] = value;
        return { ...s, polls: { ...s.polls, [stage]: { ...s.polls[stage], votes } } };
      }),

    simulatePoll: (stage) =>
      setState((s) => ({
        ...s,
        polls: { ...s.polls, [stage]: { ...s.polls[stage], votes: simulateVotes(s, stage) } },
      })),

    sealPoll: (stage: CertaintyStage) =>
      setState((s) => {
        const next: DemoState = {
          ...s,
          polls: { ...s.polls, [stage]: { ...s.polls[stage], sealed: true } },
        };
        return stage === "final" ? { ...next, stage: 8, maxStage: Math.max(next.maxStage, 8) } : next;
      }),

    toggleSelect: (round, id) =>
      setState((s) => {
        const sel = [...s.selection[round]];
        const i = sel.indexOf(id);
        if (i >= 0) {
          sel.splice(i, 1);
        } else {
          if (sel.length >= 5) return s;
          sel.push(id);
        }
        return { ...s, selection: { ...s.selection, [round]: sel } };
      }),

    upvote: (id) => setState((s) => updateChallenge(s, id, (c) => ({ ...c, upvotes: c.upvotes + 1 }))),

    setNewChallengeField: (field, value) =>
      setState((s) => ({ ...s, newChallengeDraft: { ...s.newChallengeDraft, [field]: value } }) as DemoState),

    addChallenge: () =>
      setState((s) => {
        const t = s.newChallengeDraft.text.trim();
        if (!t) return s;
        const type = s.newChallengeDraft.type;
        const newChallenge: DemoChallenge = {
          id: "u" + Date.now(),
          type,
          upvotes: 1,
          hidden: s.newChallengeDraft.hidden,
          author: "you",
          text: t,
          round: null,
          resp: { text: "", mode: "", source: "", narrowed: "" },
          tally: type === "question" ? { answered: 0, partial: 0, dodged: 0 } : { convincing: 0, notConvincing: 0 },
          narrowingRuling: null,
        };
        return {
          ...s,
          challenges: [...s.challenges, newChallenge],
          newChallengeDraft: { text: "", type, hidden: false },
        };
      }),

    buyRound: (round) =>
      setState((s) => {
        const sel = s.selection[round];
        const challenges = s.challenges.map((c) => (sel.includes(c.id) ? { ...c, round } : c));
        return advanceState({ ...s, challenges });
      }),

    setRespText: (id, text) => setState((s) => updateChallenge(s, id, (c) => ({ ...c, resp: { ...c.resp, text } }))),

    setRespMode: (id, mode: CounterfactMove) =>
      setState((s) =>
        updateChallenge(s, id, (c) => ({
          ...c,
          resp: { ...c.resp, mode, narrowed: mode === "narrow" && !c.resp.narrowed ? s.claim.current : c.resp.narrowed },
          narrowingRuling: mode === "narrow" ? c.narrowingRuling : null,
        })),
      ),

    setRespSource: (id, source) =>
      setState((s) => updateChallenge(s, id, (c) => ({ ...c, resp: { ...c.resp, source } }))),

    setRespNarrowed: (id, narrowed) =>
      setState((s) => updateChallenge(s, id, (c) => ({ ...c, resp: { ...c.resp, narrowed } }))),

    setNarrowingRuling: (id, ruling: NarrowingRuling) =>
      setState((s) => updateChallenge(s, id, (c) => ({ ...c, narrowingRuling: ruling }))),

    adjustTally: (id, field, delta) =>
      setState((s) =>
        updateChallenge(s, id, (c) => {
          const full = Object.values(c.tally as unknown as Record<string, number>).reduce((a, b) => a + b, 0);
          const jurySize = 9;
          if (delta > 0 && full >= jurySize) return c;
          const tally = { ...(c.tally as unknown as Record<string, number>) };
          const cur = tally[field] ?? 0;
          tally[field] = Math.max(0, cur + delta);
          return { ...c, tally: tally as unknown as DemoChallenge["tally"] };
        }),
      ),

    simulateTally: (id) => setState((s) => updateChallenge(s, id, (c) => ({ ...c, tally: simulateTallyFor(c) as DemoChallenge["tally"] }))),

    closeRound: (round) =>
      setState((s) => {
        let claim = s.claim;
        s.challenges.forEach((c) => {
          if (c.round === round && c.type === "counterfact" && c.resp.mode === "narrow") {
            const t = c.resp.narrowed.trim();
            if (t && t !== claim.current) {
              claim = { ...claim, current: t, history: [...claim.history, { round, text: t, by: c.author }] };
            }
          }
        });
        return advanceState({ ...s, claim });
      }),

    go: (n) => setState((s) => ({ ...s, stage: clamp(n, 0, s.maxStage), view: "play" })),
    advance: () => setState((s) => advanceState(s)),
    setView: (view) => setState((s) => ({ ...s, view })),
    reveal: () => setState((s) => ({ ...s, revealed: true })),

    newCaseOnSameClaim: () =>
      setState((s) => {
        const opening = pollMedian(s, "opening");
        const final = pollMedian(s, "final");
        if (opening == null || final == null || s.cert.opening == null || s.cert.interim == null || s.cert.final == null) {
          return s;
        }
        const bought = [...inRound(s, 1), ...inRound(s, 2)];
        const result = resolveCase({
          bountyAmount: s.bounty.amount,
          challengePrice: CHALLENGE_PRICE,
          boughtChallenges: bought.map((c) => ({ id: c.id, authorId: c.author, damage: damageOf(c) })),
          openingCertainty: { claimant: s.cert.opening, audience: opening },
          interimCertainty: { claimant: s.cert.interim, audience: pollMedian(s, "interim")! },
          finalCertainty: { claimant: s.cert.final, audience: final },
          round1Score: roundScoreOf(inRound(s, 1)),
          round2Score: roundScoreOf(inRound(s, 2)),
          wasNarrowed: wasNarrowed(s),
          wasRetreat: wasRetreat(s),
        });
        const nextBalance = s.patron.balance - s.bounty.amount + result.escrow.patronPayout;
        const keepOpen = s.challenges.filter((c) => c.round === null);
        const base = fresh();
        return {
          ...base,
          patron: { ...s.patron, balance: nextBalance },
          claimantName: s.claimantName,
          bounty: { ...s.bounty, posted: false },
          claim: { original: s.claim.current, current: s.claim.current, history: [] },
          challenges: keepOpen,
          priorCases: [...s.priorCases, { claim: s.claim.current, verdict: result.verdict, opening, final }],
        };
      }),

    resetAll: () => setState(() => fresh()),
  };

  const stageKey = STAGE_INDEX[state.stage] ?? "bounty";

  return (
    <>
      <div className="views" role="group" aria-label="View">
        <button aria-pressed={state.view === "play"} onClick={() => h.setView("play")}>
          Play
        </button>
        <button aria-pressed={state.view === "record"} onClick={() => h.setView("record")}>
          Case record
        </button>
      </div>
      <StepNav stage={state.stage} maxStage={state.maxStage} onGo={h.go} />

      <main>
        {state.view === "record" ? (
          <RecordView state={state} />
        ) : (
          <>
            {stageKey === "bounty" && <BountyStage state={state} h={h} />}
            {stageKey === "claim" && <ClaimStage state={state} h={h} />}
            {stageKey === "market1" && <MarketStage state={state} h={h} round={1} />}
            {stageKey === "defense1" && <DefenseStage state={state} h={h} round={1} />}
            {stageKey === "vote-interim" && <VoteStage state={state} h={h} stage="interim" />}
            {stageKey === "market2" && <MarketStage state={state} h={h} round={2} />}
            {stageKey === "defense2" && <DefenseStage state={state} h={h} round={2} />}
            {stageKey === "vote-final" && <VoteStage state={state} h={h} stage="final" />}
            {stageKey === "verdict" && <VerdictStage state={state} h={h} />}
          </>
        )}
      </main>

      <footer>
        <details>
          <summary>About this demo</summary>
          <p>
            Single-user demo: one person plays every role (patron, claimant, audience) to feel the
            flow of a case. It shares its scoring and payout rules with the real multiplayer app
            via the <code>@quaere/rules</code> package, but keeps its own state entirely in this
            browser&rsquo;s local storage — no account, no server, no other players.
          </p>
        </details>
        <p style={{ marginTop: 12 }}>
          <button className="link" onClick={h.resetAll}>
            Start over from scratch
          </button>
        </p>
      </footer>
    </>
  );
}
