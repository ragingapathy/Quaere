import { notFound } from "next/navigation";
import { getPlayerStats } from "@/lib/player-stats";

const VERDICT_LABEL: Record<string, string> = {
  UPHELD: "Upheld",
  AMENDED: "Amended",
  UNMOVED: "Unmoved",
  OVERTURNED: "Overturned",
  FORFEITED: "Forfeited",
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

export default async function PlayerPage({ params }: { params: { username: string } }) {
  const stats = await getPlayerStats(params.username);
  if (!stats) notFound();

  const { user } = stats;
  const memberSince = user.createdAt.toLocaleDateString(undefined, { year: "numeric", month: "long" });
  const verdictEntries = Object.entries(stats.verdictCounts).filter(([, n]) => (n ?? 0) > 0);

  return (
    <>
      <section className="sheet">
        <h1>{user.username}</h1>
        <p className="small muted">Member since {memberSince}</p>
      </section>

      <section className="sheet quiet">
        <h2>Activity</h2>
        <div className="statrow">
          <div className="stat">
            <div className="n">{stats.bountiesPosted}</div>
            <div className="l">Bounties posted, as patron</div>
          </div>
          <div className="stat">
            <div className="n">{stats.casesAsClaimant}</div>
            <div className="l">Cases run, as claimant</div>
          </div>
          <div className="stat">
            <div className="n">{stats.participantCases}</div>
            <div className="l">Cases taken part in, as audience</div>
          </div>
        </div>
      </section>

      {stats.avgCalibration != null && (
        <section className="sheet quiet">
          <h2>Calibration</h2>
          <p className="small muted">
            The average of the calibration score across every resolved case as claimant — how well
            their stated certainty tracked what the audience actually thought, not whether they won.
          </p>
          <div className="statrow">
            <div className="stat">
              <div className="n">{Math.round(stats.avgCalibration)}</div>
              <div className="l">Average calibration as claimant, of 100</div>
            </div>
          </div>
        </section>
      )}

      {verdictEntries.length > 0 && (
        <section className="sheet quiet">
          <h2>Verdicts as claimant</h2>
          <p className="small muted">Plain counts — not rolled into a win rate.</p>
          <table>
            <tbody>
              <tr>
                <th>Verdict</th>
                <th className="num">Count</th>
              </tr>
              {verdictEntries.map(([v, n]) => (
                <tr key={v}>
                  <td>{VERDICT_LABEL[v] ?? v}</td>
                  <td className="num">{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {stats.walkedAwayCount > 0 && (
        <section className="sheet quiet">
          <h2>The Record</h2>
          <p className="small">
            Walked away from {stats.walkedAwayCount} claim{stats.walkedAwayCount === 1 ? "" : "s"} —
            went quiet long enough for the case to freeze and pass to a new claimant.
          </p>
        </section>
      )}

      <section className="sheet quiet">
        <h2>Tipping</h2>
        <div className="statrow">
          <div className="stat">
            <div className="n">{stats.tipReceivedPctOfLifetime.toFixed(1)}%</div>
            <div className="l">Of lifetime earnings received as tips</div>
          </div>
          <div className="stat">
            <div className="n">{fmt(stats.totalTipsSent)}</div>
            <div className="l">Cred spent tipping others</div>
          </div>
        </div>
      </section>
    </>
  );
}
