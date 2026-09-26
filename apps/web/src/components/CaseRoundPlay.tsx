import { calibration, challengeFraction, describeSwing, VERDICT_COPY } from "@quaere/rules";
import { prisma } from "@/lib/db";
import { QUORUM, CHALLENGE_PRICE, CHALLENGES_PER_ROUND } from "@/lib/constants";
import {
  adoptFrozenClaimAction,
  buyRoundAction,
  cancelFrozenCaseAction,
  castCertaintyVoteAction,
  commitCertaintyAction,
  submitChallengeAction,
  submitDefenseAction,
  submitNarrowingRulingAction,
  submitRulingAction,
  upvoteChallengeAction,
} from "@/lib/actions/round";
import { topUpBountyAction } from "@/lib/actions/bounties";

type CaseRow = Awaited<ReturnType<typeof loadFullCase>>;

async function loadFullCase(caseId: string) {
  return prisma.case.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      bounty: { include: { patron: true } },
      claimant: true,
      narrowings: { orderBy: { createdAt: "asc" } },
      challenges: {
        include: {
          author: true,
          upvotes: true,
          rulings: true,
        },
        orderBy: { createdAt: "asc" },
      },
      certaintyVotes: true,
    },
  });
}

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${Math.round(v)}%`;
}
function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
function tallyCounts(rulings: { value: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rulings) counts[r.value] = (counts[r.value] ?? 0) + 1;
  return counts;
}
function challengeFractionOf(type: string, rulings: { value: string }[]): number {
  const c = tallyCounts(rulings);
  return type === "QUESTION"
    ? challengeFraction({ answered: c.ANSWERED ?? 0, partial: c.PARTIAL ?? 0, dodged: c.DODGED ?? 0 })
    : challengeFraction({ convincing: c.CONVINCING ?? 0, notConvincing: c.NOT_CONVINCING ?? 0 });
}

function QuorumBar({ have }: { have: number }) {
  const pctFill = Math.min(100, Math.round((have / QUORUM) * 100));
  return (
    <div className="row" style={{ alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 8, background: "var(--tint)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ width: `${pctFill}%`, height: "100%", background: "var(--green)" }} />
      </div>
      <span className="tiny muted">{have} of {QUORUM}</span>
    </div>
  );
}

function CertaintyVoteForm({
  bountyId,
  stage,
  label,
}: {
  bountyId: string;
  stage: "OPENING" | "INTERIM" | "FINAL";
  label: string;
}) {
  return (
    <form action={castCertaintyVoteAction.bind(null, bountyId, stage)}>
      <label className="field" style={{ maxWidth: 320 }}>
        <span>{label}</span>
        <input type="range" name="value" min={0} max={100} defaultValue={50} />
      </label>
      <button className="btn small" type="submit">
        Cast vote
      </button>
    </form>
  );
}

function OpeningVoteSection({ kase, viewerId }: { kase: CaseRow; viewerId: string | null }) {
  const votes = kase.certaintyVotes.filter((v) => v.stage === "OPENING");
  const myVote = viewerId ? votes.find((v) => v.userId === viewerId) : undefined;
  const isClaimant = viewerId === kase.claimantId;

  return (
    <section className="sheet quiet">
      <h2>Opening vote</h2>
      <p className="small muted">
        {kase.claimant ? <a href={`/players/${kase.claimant.username}`}>{kase.claimant.username}</a> : "The claimant"} committed to <b>{kase.openingCertainty}%</b> before any audience number
        existed. The audience votes independently; the median seals once {QUORUM} distinct votes are in.
      </p>
      <QuorumBar have={votes.length} />
      {!isClaimant &&
        (myVote ? (
          <p className="small muted" style={{ marginTop: 8 }}>
            You voted {myVote.value}%. Waiting on {Math.max(0, QUORUM - votes.length)} more.
          </p>
        ) : (
          <div style={{ marginTop: 8 }}>
            <CertaintyVoteForm bountyId={kase.bountyId} stage="OPENING" label="How certain are you?" />
          </div>
        ))}
    </section>
  );
}

function ChallengeMarketSection({
  kase,
  round,
  viewerId,
  isPatron,
}: {
  kase: CaseRow;
  round: 1 | 2;
  viewerId: string | null;
  isPatron: boolean;
}) {
  const open = kase.challenges.filter((c) => c.round === null);
  const visible = open.filter((c) => !c.hidden || isPatron);
  const maxUp = Math.max(0, ...open.map((c) => c.upvotes.length));
  const topIds = new Set(open.filter((c) => c.upvotes.length === maxUp && maxUp > 0).map((c) => c.id));
  const sorted = [...visible].sort((a, b) => b.upvotes.length - a.upvotes.length);

  return (
    <>
      <section className="sheet">
        <p className="who">Round {round} · open challenges</p>
        <h2>{isPatron ? `Buy ${CHALLENGES_PER_ROUND} challenges` : "Vote for what the claimant should answer"}</h2>
        <p className="small muted">
          Each costs {CHALLENGE_PRICE} cred, paid straight to its author the moment it's bought. The
          top-voted open challenge must be one of the {CHALLENGES_PER_ROUND} bought, so a patron can't
          dodge the audience's strongest objection.
        </p>
        {isPatron ? (
          <form action={buyRoundAction.bind(null, kase.bountyId, round)}>
            {sorted.map((c) => (
              <div className="ch" key={c.id}>
                <input type="checkbox" name="challengeId" value={c.id} aria-label="Buy this challenge" />
                <div>
                  <p className="txt">{c.text}</p>
                  <div className="row tiny">
                    <span className={c.type === "QUESTION" ? "type-q" : "type-c"}>
                      {c.type === "QUESTION" ? "Question" : "Counterfact"}
                    </span>
                    <span className="muted">
                      from <a href={`/players/${c.author.username}`}>{c.author.username}</a>
                    </span>
                    {c.hidden && <span className="pill hidden-tag">Hidden, patron only</span>}
                    {topIds.has(c.id) && <span className="pill top">Top voted</span>}
                  </div>
                </div>
                <span className="up">▲ {c.upvotes.length}</span>
              </div>
            ))}
            {sorted.length === 0 && <p className="muted small">No challenges submitted yet.</p>}
            <button className="btn" type="submit" disabled={sorted.length < CHALLENGES_PER_ROUND}>
              Buy {CHALLENGES_PER_ROUND} challenges
            </button>
          </form>
        ) : (
          <>
            {sorted.map((c) => (
              <div className="ch" key={c.id} style={{ gridTemplateColumns: "1fr auto" }}>
                <div>
                  <p className="txt">{c.text}</p>
                  <div className="row tiny">
                    <span className={c.type === "QUESTION" ? "type-q" : "type-c"}>
                      {c.type === "QUESTION" ? "Question" : "Counterfact"}
                    </span>
                    <span className="muted">
                      from <a href={`/players/${c.author.username}`}>{c.author.username}</a>
                    </span>
                    {topIds.has(c.id) && <span className="pill top">Top voted</span>}
                  </div>
                </div>
                {viewerId && viewerId !== kase.claimantId ? (
                  <form action={upvoteChallengeAction.bind(null, kase.bountyId, c.id)}>
                    <button className="up" type="submit">
                      ▲ {c.upvotes.length}
                    </button>
                  </form>
                ) : (
                  <span className="up">▲ {c.upvotes.length}</span>
                )}
              </div>
            ))}
            {sorted.length === 0 && <p className="muted small">No challenges submitted yet.</p>}
          </>
        )}
      </section>
      {viewerId && viewerId !== kase.claimantId && (
        <section className="sheet quiet">
          <h3>Submit a challenge</h3>
          <form action={submitChallengeAction.bind(null, kase.bountyId)}>
            <div className="row" style={{ marginBottom: 8 }}>
              <select name="type" style={{ maxWidth: 170 }}>
                <option value="QUESTION">Question</option>
                <option value="COUNTERFACT">Counterfact</option>
              </select>
              <label className="row small">
                <input type="checkbox" name="hidden" /> Hidden (only the patron sees it)
              </label>
            </div>
            <textarea
              name="text"
              rows={2}
              placeholder="Ask what the claim depends on, or bring a fact against it."
            />
            <div style={{ marginTop: 8 }}>
              <button className="btn ghost small" type="submit">
                Submit challenge
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

function DefenseSection({
  kase,
  round,
  viewerId,
}: {
  kase: CaseRow;
  round: 1 | 2;
  viewerId: string | null;
}) {
  const bought = kase.challenges.filter((c) => c.round === round);
  const isClaimant = viewerId === kase.claimantId;

  return (
    <section className="sheet">
      <p className="who">Round {round} defense</p>
      <h2>
        Claimant:{" "}
        {kase.claimant ? <a href={`/players/${kase.claimant.username}`}>{kase.claimant.username}</a> : "—"}
      </h2>
      <p className="small">
        <b>Current claim:</b> {kase.currentClaim}
      </p>
      {bought.map((c) => {
        const counts = tallyCounts(c.rulings);
        const myRuling = viewerId ? c.rulings.find((r) => r.userId === viewerId) : undefined;
        const answered =
          c.type === "QUESTION"
            ? !!c.respText?.trim()
            : c.respMode === "REFUTE"
              ? !!c.respSource?.trim()
              : c.respMode === "NARROW"
                ? !!c.respNarrowed?.trim() && c.narrowingRuling != null
                : c.respMode === "CONCEDE";

        return (
          <div className="defense sheet quiet" key={c.id}>
            <div className="row tiny" style={{ marginBottom: 4 }}>
              <span className={c.type === "QUESTION" ? "type-q" : "type-c"}>
                {c.type === "QUESTION" ? "Question" : "Counterfact"}
              </span>
              <span className="muted">from {c.author.username}</span>
            </div>
            <p className="serif" style={{ fontSize: 18 }}>
              {c.text}
            </p>

            {isClaimant && !answered && c.type === "QUESTION" && (
              <form action={submitDefenseAction.bind(null, kase.bountyId, c.id)}>
                <label className="field">
                  <span>Your answer</span>
                  <textarea name="text" rows={3} />
                </label>
                <button className="btn small" type="submit">
                  Submit answer
                </button>
              </form>
            )}
            {isClaimant && !answered && c.type === "COUNTERFACT" && (
              <form action={submitDefenseAction.bind(null, kase.bountyId, c.id)}>
                <label className="field">
                  <span>Response mode</span>
                  <select name="mode">
                    <option value="REFUTE">Refute with a source</option>
                    <option value="NARROW">Narrow the claim</option>
                    <option value="CONCEDE">Concede the point</option>
                  </select>
                </label>
                <label className="field">
                  <span>Source (if refuting)</span>
                  <input type="text" name="source" placeholder="Where can the audience check this?" />
                </label>
                <label className="field">
                  <span>Narrowed claim (if narrowing)</span>
                  <textarea name="narrowed" rows={2} defaultValue={kase.currentClaim} />
                </label>
                <label className="field">
                  <span>Short explanation (optional)</span>
                  <input type="text" name="text" />
                </label>
                <button className="btn small" type="submit">
                  Submit response
                </button>
              </form>
            )}

            {answered && (
              <p className="small" style={{ margin: "0 0 8px" }}>
                {c.type === "QUESTION"
                  ? c.respText
                  : c.respMode === "REFUTE"
                    ? `Refuted. Source: ${c.respSource}${c.respText ? ". " + c.respText : ""}`
                    : c.respMode === "NARROW"
                      ? `Narrowed the claim: ${c.respNarrowed}${c.respText ? ". " + c.respText : ""}`
                      : `Conceded${c.respText ? ". " + c.respText : ""}`}
              </p>
            )}

            {answered && c.type === "COUNTERFACT" && c.respMode === "NARROW" && !c.narrowingRuling && !isClaimant && viewerId && (
              <div style={{ marginBottom: 8 }}>
                <p className="tiny muted">Rule on the narrowing: refinement, or retreat?</p>
                <div className="modes" role="group">
                  <form action={submitNarrowingRulingAction.bind(null, kase.bountyId, c.id, "REFINEMENT")} style={{ display: "inline" }}>
                    <button type="submit">Refinement — no penalty</button>
                  </form>
                  <form action={submitNarrowingRulingAction.bind(null, kase.bountyId, c.id, "RETREAT")} style={{ display: "inline" }}>
                    <button type="submit">Retreat — caps swing at 50</button>
                  </form>
                </div>
              </div>
            )}

            {answered && !isClaimant && viewerId && (
              <>
                <h3 style={{ marginTop: 6 }}>Your ruling</h3>
                <form action={submitRulingAction.bind(null, kase.bountyId, c.id)}>
                  <div className="modes" role="group">
                    {(c.type === "QUESTION"
                      ? (["ANSWERED", "PARTIAL", "DODGED"] as const)
                      : (["CONVINCING", "NOT_CONVINCING"] as const)
                    ).map((v) => (
                      <button
                        key={v}
                        type="submit"
                        name="value"
                        value={v}
                        aria-pressed={myRuling?.value === v}
                      >
                        {v === "NOT_CONVINCING" ? "Not convincing" : v.charAt(0) + v.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                </form>
              </>
            )}

            <div className="spread tiny muted" style={{ marginTop: 8 }}>
              <span>{c.rulings.length} of {QUORUM} jurors have ruled</span>
            </div>
            <div style={{ height: 8, background: "var(--tint)", borderRadius: 999, overflow: "hidden", marginTop: 4 }}>
              <div
                style={{
                  width: `${Math.round(challengeFractionOf(c.type, c.rulings) * 100)}%`,
                  height: "100%",
                  background: "var(--green)",
                }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function InterimOrFinalVoteSection({
  kase,
  stage,
  viewerId,
}: {
  kase: CaseRow;
  stage: "INTERIM" | "FINAL";
  viewerId: string | null;
}) {
  const votes = kase.certaintyVotes.filter((v) => v.stage === stage);
  const myVote = viewerId ? votes.find((v) => v.userId === viewerId) : undefined;
  const isClaimant = viewerId === kase.claimantId;
  const committed = stage === "INTERIM" ? kase.interimCertainty : kase.finalCertainty;

  return (
    <section className="sheet quiet">
      <h2>{stage === "INTERIM" ? "Certainty after round 1" : "Final certainty"}</h2>
      <p className="small">
        <b>Claim:</b> {kase.currentClaim}
      </p>
      {isClaimant ? (
        committed != null ? (
          <div className="locked">
            <span aria-hidden="true">🔒</span>
            <span>
              You committed to <b>{committed}%</b> before seeing the audience.
            </span>
          </div>
        ) : (
          <form action={commitCertaintyAction.bind(null, kase.bountyId, stage)}>
            <label className="field" style={{ maxWidth: 320 }}>
              <span>How sure are you now?</span>
              <input type="range" name="value" min={0} max={100} defaultValue={50} />
            </label>
            <button className="btn small" type="submit">
              Commit (before seeing the audience)
            </button>
          </form>
        )
      ) : (
        <>
          <QuorumBar have={votes.length} />
          {myVote ? (
            <p className="small muted" style={{ marginTop: 8 }}>
              You voted {myVote.value}%.
            </p>
          ) : (
            <div style={{ marginTop: 8 }}>
              <CertaintyVoteForm bountyId={kase.bountyId} stage={stage} label="How certain are you now?" />
            </div>
          )}
        </>
      )}
    </section>
  );
}

async function VerdictSection({ kase }: { kase: CaseRow }) {
  const ledger = await prisma.ledgerEntry.findMany({
    where: {
      bountyId: kase.bountyId,
      reason: { in: ["CASE_PAYOUT_CLAIMANT", "CASE_PAYOUT_PATRON", "CASE_PAYOUT_CHALLENGER", "CHALLENGE_PURCHASE"] },
    },
    include: { user: true },
  });
  const verdict = kase.verdict!;
  const swing = (kase.finalAudience ?? 0) - (kase.openingAudience ?? 0);

  const byUser = new Map<string, { name: string; total: number }>();
  for (const entry of ledger) {
    const cur = byUser.get(entry.userId) ?? { name: entry.user.username, total: 0 };
    cur.total += entry.amount;
    byUser.set(entry.userId, cur);
  }

  return (
    <>
      <section className="sheet">
        <h2>Verdict</h2>
        <div className="reveal-num">
          <span className="n muted">{pct(kase.openingAudience)}</span>
          <span className="arrow" aria-hidden="true">→</span>
          <span className="n">{pct(kase.finalAudience)}</span>
        </div>
        <p className="small">
          Opening to final audience certainty. Swing: <b>{swing > 0 ? "+" : ""}{Math.round(swing)} points</b>.
        </p>
        <div className={`stamp v-${verdict}`}>{verdict.charAt(0) + verdict.slice(1).toLowerCase()}</div>
        <p>{VERDICT_COPY[verdict.charAt(0) + verdict.slice(1).toLowerCase() as keyof typeof VERDICT_COPY]}</p>
        <p className="small muted">
          {describeSwing(kase.openingAudience ?? 0, kase.finalAudience ?? 0, verdict.charAt(0) + verdict.slice(1).toLowerCase() as never)}
        </p>
      </section>
      <section className="sheet quiet">
        <h3>
          {kase.claimant ? <a href={`/players/${kase.claimant.username}`}>{kase.claimant.username}</a> : "—"}
          &rsquo;s grade: {Math.round(kase.grade ?? 0)} of 100
        </h3>
        <table>
          <tbody>
            <tr>
              <th>Part</th>
              <th className="num">Score</th>
              <th className="num">Weight</th>
            </tr>
            <tr>
              <td>Swing</td>
              <td className="num">{Math.round(kase.gradeSwing ?? 0)}</td>
              <td className="num">45%</td>
            </tr>
            <tr>
              <td>Defense</td>
              <td className="num">{Math.round(kase.gradeDefense ?? 0)}</td>
              <td className="num">40%</td>
            </tr>
            <tr>
              <td>Calibration</td>
              <td className="num">{Math.round(kase.gradeCalibration ?? 0)}</td>
              <td className="num">15%</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section className="sheet quiet">
        <h3>Payout</h3>
        <table>
          <tbody>
            <tr>
              <th>Who</th>
              <th className="num">Cred</th>
            </tr>
            {[...byUser.entries()].map(([id, v]) => (
              <tr key={id}>
                <td>{v.name}</td>
                <td className="num">{fmt(v.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

function FrozenSection({
  kase,
  bountyId,
  viewerId,
  isPatron,
}: {
  kase: CaseRow;
  bountyId: string;
  viewerId: string | null;
  isPatron: boolean;
}) {
  const barred = viewerId ? kase.barredClaimantIds.includes(viewerId) : false;
  return (
    <section className="sheet quiet">
      <h2>Frozen — awaiting a new claimant</h2>
      <p className="small muted">
        The last claimant went quiet for {"48"} hours. Everything else stands exactly as it was —
        the same claim, the same bought challenges, the same rulings and votes already in —
        waiting on someone new to pick up the defense.
      </p>
      <p className="small">
        <b>Claim:</b> {kase.currentClaim}
      </p>

      {viewerId && !isPatron && !barred && (
        <form action={adoptFrozenClaimAction.bind(null, bountyId)} style={{ marginTop: 8 }}>
          <button className="btn" type="submit">
            Adopt this claim
          </button>
        </form>
      )}
      {barred && (
        <p className="small muted" style={{ marginTop: 8 }}>
          You already walked away from this claim once — someone else has to pick it up.
        </p>
      )}
      {!viewerId && (
        <p className="small muted" style={{ marginTop: 8 }}>
          <a href="/login">Log in</a> or <a href="/register">register</a> to adopt it.
        </p>
      )}

      {viewerId && (
        <form action={topUpBountyAction.bind(null, bountyId)} className="row" style={{ marginTop: 16, alignItems: "flex-end" }}>
          <label className="field" style={{ maxWidth: 160 }}>
            <span>Add cred to entice a taker</span>
            <input type="number" name="amount" min={1} required />
          </label>
          <button className="btn ghost small" type="submit">
            Top up
          </button>
        </form>
      )}

      {isPatron && (
        <form action={cancelFrozenCaseAction.bind(null, bountyId)} style={{ marginTop: 16 }}>
          <button className="btn danger small" type="submit">
            Cancel and reclaim remaining escrow
          </button>
        </form>
      )}
    </section>
  );
}

export default async function CaseRoundPlay({
  bountyId,
  caseId,
  viewerId,
  isPatron,
}: {
  bountyId: string;
  caseId: string;
  viewerId: string | null;
  isPatron: boolean;
}) {
  const kase = await loadFullCase(caseId);

  return (
    <>
      {kase.narrowings.length > 0 && (
        <section className="sheet quiet">
          <h3>How the claim changed</h3>
          <p className="small" style={{ textDecoration: "line-through" }}>
            {kase.originalClaim}
          </p>
          {kase.narrowings.map((n) => (
            <p className="small" key={n.id}>
              Round {n.round}: {n.text}
            </p>
          ))}
        </section>
      )}

      {kase.frozenAt ? (
        <FrozenSection kase={kase} bountyId={bountyId} viewerId={viewerId} isPatron={isPatron} />
      ) : (
        <>
          {kase.stage === "AWAITING_OPENING_VOTE" && <OpeningVoteSection kase={kase} viewerId={viewerId} />}
          {kase.stage === "ROUND_1_OPEN" && (
            <ChallengeMarketSection kase={kase} round={1} viewerId={viewerId} isPatron={isPatron} />
          )}
          {kase.stage === "ROUND_1_DEFENSE" && <DefenseSection kase={kase} round={1} viewerId={viewerId} />}
          {kase.stage === "AWAITING_INTERIM_VOTE" && (
            <InterimOrFinalVoteSection kase={kase} stage="INTERIM" viewerId={viewerId} />
          )}
          {kase.stage === "ROUND_2_OPEN" && (
            <ChallengeMarketSection kase={kase} round={2} viewerId={viewerId} isPatron={isPatron} />
          )}
          {kase.stage === "ROUND_2_DEFENSE" && <DefenseSection kase={kase} round={2} viewerId={viewerId} />}
          {kase.stage === "AWAITING_FINAL_VOTE" && (
            <InterimOrFinalVoteSection kase={kase} stage="FINAL" viewerId={viewerId} />
          )}
          {kase.stage === "VERDICT" && <VerdictSection kase={kase} />}
          {!viewerId && kase.stage !== "VERDICT" && (
            <section className="sheet quiet">
              <p className="small">
                <a href="/login">Log in</a> or <a href="/register">register</a> to vote, challenge, or rule on
                this case.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
