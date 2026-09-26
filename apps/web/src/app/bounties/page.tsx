import { prisma } from "@/lib/db";
import { CHALLENGES_PER_ROUND, STARTING_GRANT } from "@/lib/constants";
import { getEconomyStats } from "@/lib/economy";

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export default async function BountyBoardPage() {
  const [open, claimed, stats] = await Promise.all([
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
    getEconomyStats(),
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
        <h2>The economy</h2>
        <p className="small muted">
          Registration is the only place cred is ever created — each new account mints{" "}
          {STARTING_GRANT} cred. Everything else below is that same cred moving between wallets
          and open escrow, never created or destroyed.
        </p>
        <div className="statrow">
          <div className="stat">
            <div className="n">{fmt(stats.totalUsers)}</div>
            <div className="l">Players</div>
          </div>
          <div className="stat">
            <div className="n">{fmt(stats.totalMinted)}</div>
            <div className="l">Cred ever minted</div>
          </div>
          <div className="stat">
            <div className="n">{fmt(stats.totalInWallets)}</div>
            <div className="l">Cred in wallets</div>
          </div>
          <div className="stat">
            <div className="n">{fmt(stats.totalEscrowed)}</div>
            <div className="l">Cred locked in escrow</div>
          </div>
          <div className="stat">
            <div className="n">
              {stats.openBounties} / {stats.bountiesPosted}
            </div>
            <div className="l">Open / total bounties</div>
          </div>
          <div className="stat">
            <div className="n">{stats.casesRunning}</div>
            <div className="l">Cases claimed</div>
          </div>
          <div className="stat">
            <div className="n">{stats.totalApplications}</div>
            <div className="l">Claimant applications</div>
          </div>
          <div className="stat">
            <div className="n">{stats.largestOpenBounty != null ? fmt(stats.largestOpenBounty) : "—"}</div>
            <div className="l">Largest open bounty</div>
          </div>
          <div className="stat">
            <div className="n">{fmt(stats.totalTipped)}</div>
            <div className="l">Cred ever tipped ({stats.tipCount})</div>
          </div>
          <div className="stat">
            <div className="n">{stats.tipShareOfMintedPct.toFixed(1)}%</div>
            <div className="l">Of minted cred moved as tips</div>
          </div>
        </div>
        <p className="tiny muted" style={{ marginTop: 10 }}>
          Wallets + escrow ({fmt(stats.totalInWallets + stats.totalEscrowed)}) should always equal
          cred minted ({fmt(stats.totalMinted)}) — nothing here creates or destroys cred beyond
          registration. Tips move cred between wallets 1:1 and don&rsquo;t change that total; they&rsquo;re
          broken out here because a tip is the one transfer with no game mechanic gating it, so an
          unusual share of tipped cred is worth a second look.
        </p>
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
