import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { applyToBountyAction, selectClaimantAction, withdrawApplicationAction } from "@/lib/actions/bounties";
import { ErrorBanner } from "@/components/ErrorBanner";

export default async function BountyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();

  const bounty = await prisma.bounty.findUnique({
    where: { id: params.id },
    include: {
      patron: true,
      applications: { include: { claimant: true }, orderBy: { createdAt: "asc" } },
      case: { include: { claimant: true } },
    },
  });
  if (!bounty) notFound();

  const isPatron = user?.id === bounty.patronId;
  const myApplication = user
    ? bounty.applications.find((a) => a.claimantId === user.id)
    : undefined;
  const canApply = user && !isPatron && bounty.status === "OPEN" && !bounty.case;

  const applyAction = applyToBountyAction.bind(null, bounty.id);
  const withdrawAction = withdrawApplicationAction.bind(null, bounty.id);

  return (
    <>
      <section className="sheet">
        <p className="who small muted">Posted by {bounty.patron.username}, patron</p>
        <h1>
          {bounty.amount} cred for a claim about {bounty.topic}
        </h1>
        <span className={`pill ${bounty.status === "OPEN" ? "open" : "claimed"}`}>
          {bounty.status === "OPEN" ? "Open — awaiting a claimant" : "Claimed"}
        </span>
      </section>

      <ErrorBanner message={searchParams.error} />

      {bounty.case && (
        <section className="sheet quiet">
          <h2>The case</h2>
          <p className="who small muted">Claimant: {bounty.case.claimant.username}</p>
          <p className="serif" style={{ fontSize: 18 }}>
            {bounty.case.currentClaim}
          </p>
          <p className="small muted">
            Staked at {bounty.case.openingCertainty}% certainty. Round play (challenges, defense,
            votes, verdict) isn't built yet — this is as far as the bounty board goes for now.
          </p>
        </section>
      )}

      {!user && bounty.status === "OPEN" && !bounty.case && (
        <section className="sheet quiet">
          <p className="small">
            <a href="/login">Log in</a> or <a href="/register">register</a> to answer this call.
          </p>
        </section>
      )}

      {canApply && (
        <section className="sheet quiet">
          <h2>{myApplication ? "Your application" : "Answer the call"}</h2>
          <p className="small muted">
            Stake the claim you'd defend and how sure you are of it. The patron will pick one
            claimant from everyone who applies.
          </p>
          <form action={applyAction}>
            <label className="field">
              <span>Your claim</span>
              <textarea
                name="claimText"
                rows={3}
                required
                defaultValue={myApplication?.claimText}
                placeholder={`e.g. By 2030, AI will measurably lower the cost of ${bounty.topic}.`}
              />
            </label>
            <label className="field" style={{ maxWidth: 240 }}>
              <span>How sure are you? (0-100)</span>
              <input
                type="number"
                name="certainty"
                min={0}
                max={100}
                required
                defaultValue={myApplication?.certainty ?? 60}
              />
            </label>
            <div className="row">
              <button className="btn" type="submit">
                {myApplication ? "Update application" : "Apply as claimant"}
              </button>
              {myApplication && (
                <form action={withdrawAction}>
                  <button className="btn danger small" type="submit">
                    Withdraw
                  </button>
                </form>
              )}
            </div>
          </form>
        </section>
      )}

      {isPatron && bounty.status === "OPEN" && (
        <section className="sheet quiet">
          <h2>Applicants ({bounty.applications.length})</h2>
          <p className="small muted">Choose the claimant who'll actually run this case.</p>
          {bounty.applications.length === 0 && (
            <p className="muted small">No one has answered the call yet.</p>
          )}
          {bounty.applications.map((app) => (
            <div className="entry" key={app.id}>
              <div className="spread">
                <div>
                  <span className="who small">{app.claimant.username}</span>
                  <p className="serif" style={{ margin: "4px 0", fontSize: 16 }}>
                    {app.claimText}
                  </p>
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Stated {app.certainty}% certain
                  </p>
                </div>
                <form action={selectClaimantAction.bind(null, bounty.id, app.id)}>
                  <button className="btn small" type="submit">
                    Choose as claimant
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
