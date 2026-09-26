"use client";

import {
  calibration,
  CHALLENGER_BASE_SHARE,
  CLAIMANT_SHARE,
  PATRON_FEE_SHARE,
  resolveCase,
  type ResolvedCase,
} from "@quaere/rules";
import { CHALLENGES_PER_ROUND, CHALLENGE_PRICE, JURORS } from "@/lib/constants";
import {
  CLAIMANT_PAST_RECORD,
  damageOf,
  fractionOf,
  inRound,
  isValidSelection,
  openChallenges,
  pollMedian,
  responseComplete,
  roundScoreOf,
  rulingsCastOn,
  topOpenIds,
  wasNarrowed,
  wasRetreat,
} from "@/lib/state";
import type { CertaintyStage, DemoChallenge, DemoState, Handlers } from "@/lib/types";
import { ChartSVG } from "./ChartSVG";

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function CertBlock({
  state,
  h,
  stage,
  label,
}: {
  state: DemoState;
  h: Handlers;
  stage: CertaintyStage;
  label: string;
}) {
  const locked = state.cert[stage] != null;
  if (locked) {
    return (
      <div className="locked">
        <span aria-hidden="true">🔒</span>
        <span>
          {state.claimantName} committed to <b>{state.cert[stage]}%</b> before seeing the
          audience.
        </span>
      </div>
    );
  }
  return (
    <>
      <div className="certainty">
        <label className="field" style={{ margin: 0 }}>
          <span>{label}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={state.draft[stage]}
            aria-label={label}
            onChange={(e) => h.setDraft(stage, +e.target.value)}
          />
        </label>
        <output className="bignum">{state.draft[stage]}%</output>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn" onClick={() => h.lockCertainty(stage)}>
          Lock {state.claimantName}&rsquo;s certainty
        </button>
        <span className="tiny muted">The audience vote stays hidden until this is locked.</span>
      </div>
    </>
  );
}

function PollBlock({
  state,
  h,
  stage,
  title,
  sealLabel,
}: {
  state: DemoState;
  h: Handlers;
  stage: CertaintyStage;
  title: string;
  sealLabel: string;
}) {
  const poll = state.polls[stage];
  if (state.cert[stage] == null) return null;

  if (poll.sealed && stage !== "final") {
    const m = pollMedian(state, stage)!;
    const prev = stage === "interim" ? pollMedian(state, "opening") : null;
    return (
      <section className="sheet quiet">
        <h3>{title}</h3>
        <div className="reveal-num">
          {prev != null && (
            <>
              <span className="n muted">{pct(prev)}</span>
              <span className="arrow" aria-hidden="true">
                →
              </span>
            </>
          )}
          <span className="n">{pct(m)}</span>
        </div>
        <p className="small muted">
          Trimmed median of {JURORS.length} jurors (highest and lowest dropped).{" "}
          {state.claimantName} said {state.cert[stage]}%, so calibration earns{" "}
          <b>{calibration(state.cert[stage], m)}</b> of 100.
        </p>
      </section>
    );
  }

  return (
    <section className="sheet quiet">
      <h3>{title}</h3>
      <p className="small muted">
        Play the jurors: set each vote, or simulate them. Simulated jurors react to how well the
        last round was defended.
      </p>
      <div className="jurors">
        {JURORS.map((name, i) => (
          <div className="juror" key={name}>
            <span>{name}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={poll.votes[i]}
              aria-label={`${name}'s certainty`}
              onChange={(e) => h.setVote(stage, i, +e.target.value)}
            />
            <output>{poll.votes[i]}%</output>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost small" onClick={() => h.simulatePoll(stage)}>
          Simulate jurors
        </button>
        <button className="btn" onClick={() => h.sealPoll(stage)}>
          {sealLabel}
        </button>
      </div>
    </section>
  );
}

export function BountyStage({ state, h }: { state: DemoState; h: Handlers }) {
  const b = state.bounty;
  const disabled = b.posted;
  return (
    <>
      <section className="sheet">
        <p className="who">Posted by {state.patron.name}, patron</p>
        <h1>
          {fmt(b.amount)} cred for a claim about {b.topic}
        </h1>
        <p className="lede">
          A patron funds a case. A claimant stakes a claim and a certainty. The audience
          challenges it, votes, and votes again. The claim is paid for how far it moves the
          audience, not for how many people already agreed.
        </p>
        <div className="grid2">
          <label className="field">
            <span>Topic</span>
            <input
              type="text"
              value={b.topic}
              disabled={disabled}
              onChange={(e) => h.setTopic(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Bounty (you have {fmt(state.patron.balance)} cred)</span>
            <input
              type="number"
              min={1}
              max={state.patron.balance}
              step={50}
              value={b.amount}
              disabled={disabled}
              onChange={(e) => h.setAmount(+e.target.value)}
            />
          </label>
        </div>
        <p className="tiny muted">
          Fixed at {CHALLENGES_PER_ROUND} challenges per round for this build.
        </p>
        {b.posted ? (
          <div className="locked">Bounty posted. {fmt(b.amount)} cred is in escrow.</div>
        ) : (
          <button className="btn" onClick={h.postBounty}>
            Post bounty
          </button>
        )}
      </section>
      <section className="sheet quiet">
        <h2>Where the bounty goes</h2>
        <p className="small">
          Every cred in escrow ends up with someone. Nothing is created from thin air.
        </p>
        <div className="scroll">
          <table>
            <tbody>
              <tr>
                <th>Share</th>
                <th>Who</th>
                <th>Earned by</th>
              </tr>
              <tr>
                <td>{CHALLENGE_PRICE} per challenge</td>
                <td>Challengers</td>
                <td>
                  Having a challenge bought. This is how audience members get their first stake.
                </td>
              </tr>
              <tr>
                <td>Up to {Math.round(CLAIMANT_SHARE * 100)}%</td>
                <td>Claimant</td>
                <td>
                  A grade built from swing (45%), defense (40%), and calibration (15%). Whatever
                  isn&rsquo;t earned goes to the challengers.
                </td>
              </tr>
              <tr>
                <td>{Math.round(CHALLENGER_BASE_SHARE * 100)}%</td>
                <td>Challengers</td>
                <td>Split by how much each challenge hurt the defense.</td>
              </tr>
              <tr>
                <td>Up to {Math.round(PATRON_FEE_SHARE * 100)}%</td>
                <td>Patron</td>
                <td>Hosting a case that actually moved the audience. Unearned fee goes to the challengers.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export function ClaimStage({ state, h }: { state: DemoState; h: Handlers }) {
  const locked = state.cert.opening != null;
  return (
    <>
      <section className="sheet">
        <p className="who">Claimant: {state.claimantName}</p>
        <h2>State the claim</h2>
        <label className="field">
          <span>Claim</span>
          <textarea
            rows={3}
            value={state.claim.current}
            disabled={locked}
            onChange={(e) => h.setClaimText(e.target.value)}
          />
        </label>
        <CertBlock state={state} h={h} stage="opening" label={`How sure is ${state.claimantName}?`} />
        <details>
          <summary>{state.claimantName}&rsquo;s record</summary>
          <div className="scroll">
            <table>
              <tbody>
                <tr>
                  <th>Past claim</th>
                  <th>Verdict</th>
                  <th className="num">Swing</th>
                </tr>
                {CLAIMANT_PAST_RECORD.map((p, i) => (
                  <tr key={i}>
                    <td>{p.claim}</td>
                    <td className={`v-${p.verdict}`}>{p.verdict}</td>
                    <td className="num">
                      {p.final - p.opening > 0 ? "+" : ""}
                      {p.final - p.opening}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tiny muted" style={{ marginTop: 8 }}>
            Audiences use this page to decide how much weight to give a claimant.
          </p>
        </details>
      </section>
      <PollBlock state={state} h={h} stage="opening" title="Opening vote" sealLabel="Seal and reveal the opening vote" />
      {state.polls.opening.sealed && (
        <button className="btn" onClick={h.advance}>
          Open the round 1 market
        </button>
      )}
    </>
  );
}

function TallyCtl({ c, h }: { c: DemoChallenge; h: Handlers }) {
  const full = rulingsCastOn(c) >= JURORS.length;
  const opts =
    c.type === "question"
      ? ([
          ["answered", "Answered"],
          ["partial", "Partial"],
          ["dodged", "Dodged"],
        ] as const)
      : ([
          ["convincing", "Convincing"],
          ["notConvincing", "Not convinced"],
        ] as const);
  const tally = c.tally as unknown as Record<string, number>;
  return (
    <>
      <div className="tally">
        {opts.map(([key, label]) => (
          <span className="tcell" key={key}>
            {label}
            <button disabled={!tally[key]} aria-label={`Fewer ${label}`} onClick={() => h.adjustTally(c.id, key, -1)}>
              −
            </button>
            <b>{tally[key]}</b>
            <button disabled={full} aria-label={`More ${label}`} onClick={() => h.adjustTally(c.id, key, 1)}>
              +
            </button>
          </span>
        ))}
      </div>
      <div className="spread tiny muted">
        <span>
          {rulingsCastOn(c)} of {JURORS.length} jurors have ruled
        </span>
        <button className="link" onClick={() => h.simulateTally(c.id)}>
          Simulate jury
        </button>
      </div>
      <div className="bar" aria-hidden="true">
        <i style={{ width: `${Math.round(fractionOf(c) * 100)}%` }} />
      </div>
    </>
  );
}

export function MarketStage({ state, h, round }: { state: DemoState; h: Handlers; round: 1 | 2 }) {
  const bought = inRound(state, round);
  if (bought.length > 0) {
    return (
      <section className="sheet">
        <h2>Round {round} challenges bought</h2>
        {bought.map((c) => (
          <div className="ch" style={{ gridTemplateColumns: "1fr" }} key={c.id}>
            <div>
              <p className="txt">{c.text}</p>
              <div className="row tiny">
                <span className={c.type === "question" ? "type-q" : "type-c"}>
                  {c.type === "question" ? "Question" : "Counterfact"}
                </span>
                <span className="muted">from {c.author}</span>
              </div>
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => h.go(state.stage + 1)}>
          Go to the defense
        </button>
      </section>
    );
  }

  const sel = state.selection[round];
  const tops = topOpenIds(state);
  const hasTop = sel.some((id) => tops.includes(id));
  const ok = isValidSelection(state, round, CHALLENGES_PER_ROUND);
  const list = [...openChallenges(state)].sort((a, b) => b.upvotes - a.upvotes);

  return (
    <>
      <section className="sheet">
        <p className="who">Patron: {state.patron.name}</p>
        <h2>
          Buy {CHALLENGES_PER_ROUND} challenges for round {round}
        </h2>
        <p className="small">
          Each costs {CHALLENGE_PRICE} cred from escrow and goes straight to its author. The
          top-voted open challenge must be one of them, so the patron can&rsquo;t dodge the
          audience&rsquo;s strongest objection. Hidden challenges are visible only to the patron.
        </p>
        <div className={`status ${ok ? "ok" : "warn"}`}>
          {sel.length} of {CHALLENGES_PER_ROUND} selected
          {hasTop ? "" : ", and the top-voted challenge is not included yet"}.
        </div>
        {list.map((c) => (
          <div className={`ch ${sel.includes(c.id) ? "on" : ""}`} key={c.id}>
            <input
              type="checkbox"
              checked={sel.includes(c.id)}
              aria-label="Buy this challenge"
              onChange={() => h.toggleSelect(round, c.id)}
            />
            <div>
              <p className="txt">{c.text}</p>
              <div className="row tiny">
                <span className={c.type === "question" ? "type-q" : "type-c"}>
                  {c.type === "question" ? "Question" : "Counterfact"}
                </span>
                <span className="muted">from {c.author}</span>
                {c.hidden && <span className="pill hidden-tag">Hidden, patron only</span>}
                {tops.includes(c.id) && <span className="pill top">Top voted</span>}
              </div>
            </div>
            <button className="up" onClick={() => h.upvote(c.id)} aria-label="Upvote">
              ▲ {c.upvotes}
            </button>
          </div>
        ))}
        <button className="btn" disabled={!ok} onClick={() => h.buyRound(round)}>
          Buy {CHALLENGES_PER_ROUND} challenges ({CHALLENGES_PER_ROUND * CHALLENGE_PRICE} cred)
        </button>
      </section>
      <section className="sheet quiet">
        <h3>Submit a challenge as the audience</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <select
            value={state.newChallengeDraft.type}
            style={{ maxWidth: 170 }}
            onChange={(e) => h.setNewChallengeField("type", e.target.value)}
          >
            <option value="question">Question</option>
            <option value="counterfact">Counterfact</option>
          </select>
          <label className="row small">
            <input
              type="checkbox"
              checked={state.newChallengeDraft.hidden}
              onChange={(e) => h.setNewChallengeField("hidden", e.target.checked)}
            />{" "}
            Hidden (only the patron sees it)
          </label>
        </div>
        <textarea
          rows={2}
          value={state.newChallengeDraft.text}
          placeholder="Ask what the claim depends on, or bring a fact against it."
          onChange={(e) => h.setNewChallengeField("text", e.target.value)}
        />
        <div style={{ marginTop: 8 }}>
          <button className="btn ghost small" onClick={h.addChallenge}>
            Submit challenge
          </button>
        </div>
      </section>
    </>
  );
}

export function DefenseStage({ state, h, round }: { state: DemoState; h: Handlers; round: 1 | 2 }) {
  const list = inRound(state, round);
  if (list.length === 0) {
    return (
      <section className="sheet">
        <p>Buy challenges first.</p>
      </section>
    );
  }
  const closed = state.maxStage > state.stage;
  const all = list.every((c) => responseComplete(c, state.claim.current));

  return (
    <>
      <section className="sheet">
        <p className="who">Claimant: {state.claimantName}</p>
        <h2>Round {round} defense</h2>
        <p className="small">
          <b>Current claim:</b> {state.claim.current}
        </p>
        <p className="small muted">
          Each answer is judged by the jurors, not the patron. Questions are rated answered,
          partial, or dodged. For counterfacts, the jury rules on whether the response was fair
          and convincing: a sourced refutation, an honest narrowing of the claim, or an honest
          concession.
        </p>
      </section>
      {list.map((c) => (
        <section className="defense sheet quiet" key={c.id}>
          <div className="row tiny" style={{ marginBottom: 4 }}>
            <span className={c.type === "question" ? "type-q" : "type-c"}>
              {c.type === "question" ? "Question" : "Counterfact"}
            </span>
            <span className="muted">from {c.author}</span>
          </div>
          <p className="serif" style={{ fontSize: 18 }}>
            {c.text}
          </p>
          {c.type === "question" ? (
            <label className="field">
              <span>{state.claimantName}&rsquo;s answer</span>
              <textarea
                rows={3}
                value={c.resp.text}
                disabled={closed}
                onChange={(e) => h.setRespText(c.id, e.target.value)}
              />
            </label>
          ) : (
            <>
              <div className="modes" role="group" aria-label="Response">
                {(
                  [
                    ["refute", "Refute with a source"],
                    ["narrow", "Narrow the claim"],
                    ["concede", "Concede the point"],
                  ] as const
                ).map(([m, l]) => (
                  <button
                    key={m}
                    disabled={closed}
                    aria-pressed={c.resp.mode === m}
                    onClick={() => h.setRespMode(c.id, m)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {c.resp.mode === "refute" && (
                <label className="field">
                  <span>Source</span>
                  <input
                    type="text"
                    value={c.resp.source}
                    placeholder="Where can the audience check this?"
                    disabled={closed}
                    onChange={(e) => h.setRespSource(c.id, e.target.value)}
                  />
                </label>
              )}
              {c.resp.mode === "narrow" && (
                <>
                  <label className="field">
                    <span>Narrowed claim (replaces the current claim when the round closes)</span>
                    <textarea
                      rows={3}
                      value={c.resp.narrowed || state.claim.current}
                      disabled={closed}
                      onChange={(e) => h.setRespNarrowed(c.id, e.target.value)}
                    />
                  </label>
                  <p className="tiny muted" style={{ marginBottom: 4 }}>
                    Audience ruling on the narrowing:
                  </p>
                  <div className="modes" role="group" aria-label="Ruling on the narrowing">
                    <button
                      disabled={closed}
                      aria-pressed={c.narrowingRuling === "refinement"}
                      onClick={() => h.setNarrowingRuling(c.id, "refinement")}
                    >
                      Refinement — no penalty
                    </button>
                    <button
                      disabled={closed}
                      aria-pressed={c.narrowingRuling === "retreat"}
                      onClick={() => h.setNarrowingRuling(c.id, "retreat")}
                    >
                      Retreat — caps swing at 50
                    </button>
                  </div>
                </>
              )}
              {c.resp.mode && (
                <label className="field">
                  <span>Short explanation (optional)</span>
                  <input
                    type="text"
                    value={c.resp.text}
                    disabled={closed}
                    onChange={(e) => h.setRespText(c.id, e.target.value)}
                  />
                </label>
              )}
            </>
          )}
          <h3 style={{ marginTop: 6 }}>Jury ruling</h3>
          <TallyCtl c={c} h={h} />
        </section>
      ))}
      <div className="sheet quiet spread">
        <span>
          Round {round} defense score: <b>{Math.round(roundScoreOf(list))}</b> of 100
        </span>
        {closed ? (
          <button className="btn" onClick={() => h.go(state.stage + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn" disabled={!all} onClick={() => h.closeRound(round)}>
            Close round {round}
          </button>
        )}
      </div>
      {!(all || closed) && (
        <p className="tiny muted">
          Every challenge needs a response and a full jury ruling before the round can close.
        </p>
      )}
    </>
  );
}

export function VoteStage({ state, h, stage }: { state: DemoState; h: Handlers; stage: "interim" | "final" }) {
  const isFinal = stage === "final";
  const title = isFinal ? "Final certainty" : "Update certainty after round 1";
  return (
    <>
      <section className="sheet">
        <p className="who">Claimant: {state.claimantName}</p>
        <h2>{title}</h2>
        <p className="small">
          <b>Claim:</b> {state.claim.current}
        </p>
        <p className="small muted">
          {state.claimantName} commits first, without seeing the new audience number.
          {isFinal ? " The final vote stays sealed until the verdict is opened." : ""}
        </p>
        <CertBlock state={state} h={h} stage={stage} label={`How sure is ${state.claimantName} now?`} />
      </section>
      <PollBlock
        state={state}
        h={h}
        stage={stage}
        title={isFinal ? "Final vote, sealed until the verdict" : "Round 1 vote"}
        sealLabel={isFinal ? "Seal the final vote" : "Seal and reveal the round 1 vote"}
      />
      {!isFinal && state.polls.interim.sealed && (
        <button className="btn" onClick={h.advance}>
          Open the round 2 market
        </button>
      )}
    </>
  );
}

function computeResult(state: DemoState): ResolvedCase | null {
  const opening = pollMedian(state, "opening");
  const interim = pollMedian(state, "interim");
  const final = pollMedian(state, "final");
  if (opening == null || interim == null || final == null) return null;
  if (state.cert.opening == null || state.cert.interim == null || state.cert.final == null) {
    return null;
  }
  const bought = [...inRound(state, 1), ...inRound(state, 2)];
  return resolveCase({
    bountyAmount: state.bounty.amount,
    challengePrice: CHALLENGE_PRICE,
    boughtChallenges: bought.map((c) => ({ id: c.id, authorId: c.author, damage: damageOf(c) })),
    openingCertainty: { claimant: state.cert.opening, audience: opening },
    interimCertainty: { claimant: state.cert.interim, audience: interim },
    finalCertainty: { claimant: state.cert.final, audience: final },
    round1Score: roundScoreOf(inRound(state, 1)),
    round2Score: roundScoreOf(inRound(state, 2)),
    wasNarrowed: wasNarrowed(state),
    wasRetreat: wasRetreat(state),
  });
}

function Ledger({ state, result }: { state: DemoState; result: ResolvedCase }) {
  const byAuthor = new Map<string, { buy: number; pool: number }>();
  result.escrow.challengerShares.forEach((s) => {
    const cur = byAuthor.get(s.authorId) ?? { buy: 0, pool: 0 };
    cur.buy += s.purchasePay;
    cur.pool += s.poolPay;
    byAuthor.set(s.authorId, cur);
  });
  const patronBalanceAfter = state.patron.balance - state.bounty.amount + result.escrow.patronPayout;
  const totalOut =
    result.escrow.claimantPayout +
    result.escrow.patronPayout +
    [...byAuthor.values()].reduce((s, p) => s + p.buy + p.pool, 0);

  return (
    <section className="sheet quiet">
      <h3>Payout from {fmt(state.bounty.amount)} cred escrow</h3>
      <div className="scroll">
        <table>
          <tbody>
            <tr>
              <th>Who</th>
              <th>For</th>
              <th className="num">Cred</th>
            </tr>
            <tr>
              <td>{state.claimantName}</td>
              <td>Grade {Math.round(result.grade.grade)} × claimant share</td>
              <td className="num">{fmt(result.escrow.claimantPayout)}</td>
            </tr>
            <tr>
              <td>{state.patron.name}</td>
              <td>Hosting fee, scaled by how much the audience moved</td>
              <td className="num">{fmt(result.escrow.patronPayout)}</td>
            </tr>
            {[...byAuthor.entries()].map(([name, p]) => (
              <tr key={name}>
                <td>{name}</td>
                <td>Challenge bought, plus share of the challenger pool</td>
                <td className="num">{fmt(p.buy + p.pool)}</td>
              </tr>
            ))}
            <tr>
              <th>Total</th>
              <th></th>
              <th className="num">{fmt(totalOut)}</th>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ marginTop: 8 }}>
        {state.patron.name}&rsquo;s balance after this case: {fmt(patronBalanceAfter)} cred, which
        can fund the next bounty.
      </p>
    </section>
  );
}

export function VerdictStage({ state, h }: { state: DemoState; h: Handlers }) {
  if (!state.polls.final.sealed) {
    return (
      <section className="sheet">
        <p>The final vote isn&rsquo;t sealed yet.</p>
      </section>
    );
  }
  if (!state.revealed) {
    return (
      <section className="sheet">
        <h2>The jury is back</h2>
        <div className="envelope">
          <div>
            <div className="seal" aria-hidden="true">
              Q
            </div>
            <p className="serif" style={{ fontSize: 18 }}>
              {state.claim.current}
            </p>
            <button className="btn" onClick={h.reveal}>
              Break the seal
            </button>
          </div>
        </div>
      </section>
    );
  }

  const opening = pollMedian(state, "opening");
  const final = pollMedian(state, "final");
  const result = computeResult(state);
  if (!result || opening == null || final == null) return null;

  return (
    <>
      <section className="sheet">
        <h2>Verdict</h2>
        <div className="reveal-num">
          <span className="n muted">{pct(opening)}</span>
          <span className="arrow" aria-hidden="true">
            →
          </span>
          <span className="n">{pct(final)}</span>
        </div>
        <p className="small">
          Opening audience certainty to final. Swing:{" "}
          <b>
            {final - opening > 0 ? "+" : ""}
            {Math.round(final - opening)} points
          </b>
          .
        </p>
        <div className={`stamp v-${result.verdict}`}>{result.verdict}</div>
        <p>{result.verdictCopy}</p>
        <p className="small muted">{result.swingDescription}</p>
      </section>
      <section className="sheet quiet">
        <h3>
          {state.claimantName}&rsquo;s grade: {Math.round(result.grade.grade)} of 100
        </h3>
        <div className="scroll">
          <table>
            <tbody>
              <tr>
                <th>Part</th>
                <th className="num">Score</th>
                <th className="num">Weight</th>
              </tr>
              <tr>
                <td>Swing (+20 points of swing earns full marks)</td>
                <td className="num">{Math.round(result.grade.swing)}</td>
                <td className="num">45%</td>
              </tr>
              <tr>
                <td>Defense (jury rulings, both rounds)</td>
                <td className="num">{Math.round(result.grade.defense)}</td>
                <td className="num">40%</td>
              </tr>
              <tr>
                <td>Calibration (committed certainty vs. audience)</td>
                <td className="num">{Math.round(result.grade.calibration)}</td>
                <td className="num">15%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <Ledger state={state} result={result} />
      <div className="row">
        <button className="btn" onClick={() => h.setView("record")}>
          Read the case record
        </button>
        <button className="btn ghost" onClick={h.newCaseOnSameClaim}>
          Open a new case on this claim
        </button>
      </div>
    </>
  );
}

export function RecordView({ state }: { state: DemoState }) {
  const opening = pollMedian(state, "opening");
  const interim = pollMedian(state, "interim");
  const final = pollMedian(state, "final");
  const result = state.revealed ? computeResult(state) : null;
  const usedRounds = ([1, 2] as const)
    .map((r) => ({ r, list: inRound(state, r) }))
    .filter((x) => x.list.length > 0);

  return (
    <>
      <article className="sheet">
        <p className="who">
          Case record{state.priorCases.length ? `, case ${state.priorCases.length + 1} on this claim` : ""}
        </p>
        <h1>{state.claim.current}</h1>
        {result ? (
          <>
            <div className={`stamp v-${result.verdict}`}>{result.verdict}</div>
            <p className="small">
              Audience {pct(opening)} → {pct(final)}, swing{" "}
              {final! - opening! > 0 ? "+" : ""}
              {Math.round(final! - opening!)}. Claimant {state.claimantName}, patron{" "}
              {state.patron.name}.
            </p>
          </>
        ) : (
          <p className="small muted">Case in progress. The page fills in as the case is played.</p>
        )}
        {state.claim.history.length > 0 && (
          <>
            <h3>How the claim changed</h3>
            <p className="small" style={{ textDecoration: "line-through" }}>
              {state.claim.original}
            </p>
            {state.claim.history.map((hEvt, i) => (
              <p className="small" key={i}>
                Round {hEvt.round}, answering {hEvt.by}: {hEvt.text}
              </p>
            ))}
          </>
        )}
        {state.cert.opening != null && (
          <>
            <h3 style={{ marginTop: 14 }}>Certainty over the case</h3>
            <ChartSVG
              claimantName={state.claimantName}
              points={[
                { x: 40, label: "Opening", audience: opening, claimant: state.cert.opening },
                { x: 160, label: "Round 1", audience: interim, claimant: state.cert.interim },
                { x: 280, label: "Final", audience: state.revealed ? final : null, claimant: state.cert.final },
              ]}
            />
          </>
        )}
      </article>
      {usedRounds.map(({ r, list }) => (
        <section className="sheet quiet" key={r}>
          <h2>Round {r}</h2>
          {list.map((c) => {
            const rr = c.resp;
            const respText =
              c.type === "question"
                ? rr.text || "No answer yet."
                : rr.mode === "refute"
                  ? `Refuted. Source: ${rr.source}${rr.text ? ". " + rr.text : ""}`
                  : rr.mode === "narrow"
                    ? `Narrowed the claim${rr.text ? ". " + rr.text : ""}`
                    : rr.mode === "concede"
                      ? `Conceded${rr.text ? ". " + rr.text : ""}`
                      : "No response yet.";
            const tally = c.tally as unknown as Record<string, number>;
            const ruleText =
              c.type === "question"
                ? `Answered ${tally.answered ?? 0}, partial ${tally.partial ?? 0}, dodged ${tally.dodged ?? 0}`
                : `${tally.convincing ?? 0} of ${JURORS.length} found the response fair and convincing`;
            return (
              <div className="chblock" key={c.id}>
                <div className="row tiny">
                  <span className={c.type === "question" ? "type-q" : "type-c"}>
                    {c.type === "question" ? "Question" : "Counterfact"}
                  </span>
                  <span className="muted">from {c.author}</span>
                </div>
                <p className="serif" style={{ margin: "4px 0" }}>
                  {c.text}
                </p>
                <p className="small" style={{ margin: 0 }}>
                  {respText}
                </p>
                <p className="tiny muted" style={{ margin: "4px 0 0" }}>
                  {ruleText}
                </p>
                <div className="bar">
                  <i style={{ width: `${Math.round(fractionOf(c) * 100)}%` }} />
                </div>
              </div>
            );
          })}
        </section>
      ))}
      {result && <Ledger state={state} result={result} />}
      {state.priorCases.length > 0 && (
        <section className="sheet quiet">
          <h3>Earlier cases on this claim</h3>
          {state.priorCases.map((p, i) => (
            <p className="small" key={i}>
              Case {i + 1}: &ldquo;{p.claim}&rdquo;, <span className={`v-${p.verdict}`}>{p.verdict}</span>,{" "}
              {pct(p.opening)} → {pct(p.final)}.
            </p>
          ))}
        </section>
      )}
    </>
  );
}
