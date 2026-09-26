import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const STAGE_LABEL: Record<string, string> = {
  AWAITING_OPENING_VOTE: "Opening vote",
  ROUND_1_OPEN: "Round 1 — buying challenges",
  ROUND_1_DEFENSE: "Round 1 — defense",
  AWAITING_INTERIM_VOTE: "Round 1 vote",
  ROUND_2_OPEN: "Round 2 — buying challenges",
  ROUND_2_DEFENSE: "Round 2 — defense",
  AWAITING_FINAL_VOTE: "Final vote",
  VERDICT: "Verdict in",
  FORFEITED: "Forfeited",
};

export default async function MinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Log in to see your cases."));

  const [asPatron, asClaimant, participantRows] = await Promise.all([
    prisma.bounty.findMany({
      where: { patronId: user.id },
      include: { case: true, applications: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.case.findMany({
      where: { claimantId: user.id },
      include: { bounty: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.caseParticipant.findMany({
      where: { userId: user.id },
      include: { case: { include: { bounty: true } } },
    }),
  ]);

  type Row = { bountyId: string; topic: string; stage: string | null; bountyStatus: string; roles: Set<string> };
  const byBounty = new Map<string, Row>();

  function upsert(bountyId: string, topic: string, stage: string | null, bountyStatus: string, role: string) {
    const row = byBounty.get(bountyId) ?? { bountyId, topic, stage, bountyStatus, roles: new Set<string>() };
    row.roles.add(role);
    byBounty.set(bountyId, row);
  }

  for (const b of asPatron) upsert(b.id, b.topic, b.case?.stage ?? null, b.status, "patron");
  for (const c of asClaimant) upsert(c.bounty.id, c.bounty.topic, c.stage, c.bounty.status, "claimant");
  for (const p of participantRows) {
    upsert(p.case.bounty.id, p.case.bounty.topic, p.case.stage, p.case.bounty.status, "audience");
  }

  const rows = [...byBounty.values()].sort((a, b) => {
    const aDone = a.stage === "VERDICT" || a.stage === "FORFEITED";
    const bDone = b.stage === "VERDICT" || b.stage === "FORFEITED";
    return aDone === bDone ? 0 : aDone ? 1 : -1;
  });

  return (
    <section className="sheet">
      <h1>Your live claims</h1>
      <p className="small muted">Every case where you're the patron, the claimant, or part of the audience.</p>
      {rows.length === 0 && <p className="muted small">Nothing yet — post a bounty or answer a call.</p>}
      {rows.map((r) => (
        <div className="entry" key={r.bountyId}>
          <div className="spread">
            <div>
              <a href={`/bounties/${r.bountyId}`}>{r.topic}</a>
              <p className="tiny muted" style={{ margin: "2px 0 0" }}>
                {[...r.roles].join(", ")}
              </p>
            </div>
            <span className="pill">
              {r.stage ? STAGE_LABEL[r.stage] ?? r.stage : r.bountyStatus === "OPEN" ? "Awaiting a claimant" : r.bountyStatus}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
