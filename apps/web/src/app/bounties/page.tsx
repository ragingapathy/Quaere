import { prisma } from "@/lib/db";
import { CHALLENGES_PER_ROUND } from "@/lib/constants";

export default async function BountyBoardPage() {
  const [open, claimed] = await Promise.all([
    prisma.bounty.findMany({
      where: { status: "OPEN" },
      include: { patron: true, applications: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bounty.findMany({
      where: { status: "CLAIMED" },
      include: { patron: true, case: { include: { claimant: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <>
      <section className="sheet">
        <h1>The bounty board</h1>
        <p className="lede">
          A patron funds a case here. Claimants who want it answer the call below with their own
          claim and a stated certainty; the patron picks one to actually run the case.
        </p>
        <a className="btn" href="/bounties/new">
          Post a bounty
        </a>
      </section>

      <section className="sheet quiet">
        <h2>Open calls</h2>
        {open.length === 0 && <p className="muted small">No open bounties right now.</p>}
        {open.map((b) => (
          <div className="entry" key={b.id}>
            <div className="spread">
              <div>
                <a href={`/bounties/${b.id}`}>
                  <strong>{b.amount} cred</strong> — {b.topic}
                </a>
                <p className="tiny muted" style={{ margin: "2px 0 0" }}>
                  Posted by {b.patron.username} · {b.applications.length} applicant
                  {b.applications.length === 1 ? "" : "s"} · {CHALLENGES_PER_ROUND} challenges per
                  round
                </p>
              </div>
              <span className="pill open">Open</span>
            </div>
          </div>
        ))}
      </section>

      {claimed.length > 0 && (
        <section className="sheet quiet">
          <h2>Recently claimed</h2>
          {claimed.map((b) => (
            <div className="entry" key={b.id}>
              <div className="spread">
                <div>
                  <a href={`/bounties/${b.id}`}>{b.topic}</a>
                  <p className="tiny muted" style={{ margin: "2px 0 0" }}>
                    {b.case?.claimant.username} is staking:{" "}
                    {b.case?.currentClaim ?? "(claim pending)"}
                  </p>
                </div>
                <span className="pill claimed">Claimed</span>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
