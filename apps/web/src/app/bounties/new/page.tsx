import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { postBountyAction } from "@/lib/actions/bounties";
import { ErrorBanner } from "@/components/ErrorBanner";
import { CHALLENGES_PER_ROUND } from "@/lib/constants";
import { CHALLENGER_BASE_SHARE, CLAIMANT_SHARE, PATRON_FEE_SHARE } from "@quaere/rules";

export default async function NewBountyPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?error=" + encodeURIComponent("Log in to post a bounty."));

  return (
    <>
      <section className="sheet">
        <h1>Post a bounty</h1>
        <p className="small muted">
          You have {user.balance} cred. Posting a bounty escrows the full amount immediately.
        </p>
        <ErrorBanner message={searchParams.error} />
        <form action={postBountyAction}>
          <label className="field">
            <span>Topic</span>
            <input type="text" name="topic" required placeholder="e.g. AI and the cost of living" />
            <p className="tiny muted" style={{ marginTop: 4 }}>
              Fund a subject, not a claim. The claimant who answers your call is the one who stakes
              the actual claim and how sure they are of it — a topic that's already a specific,
              dated assertion doesn't leave them anything to stake. <b>Too narrow:</b> "An AI-related
              breach will happen in the next 5 months." <b>Better:</b> "AI and the next cybersecurity
              incident" — it names the ground without picking the claim for them.
            </p>
          </label>
          <label className="field" style={{ maxWidth: 280 }}>
            <span>Bounty amount (cred)</span>
            <input type="number" name="amount" min={1} max={user.balance} step={10} required />
          </label>
          <p className="tiny muted">
            Fixed at {CHALLENGES_PER_ROUND} challenges per round for this build.
          </p>
          <button className="btn" type="submit">
            Post bounty
          </button>
        </form>
      </section>

      <section className="sheet quiet">
        <h2>Where the bounty goes</h2>
        <p className="small">
          Every cred in escrow ends up with someone once the case resolves. Nothing is created
          from thin air.
        </p>
        <table>
          <tbody>
            <tr>
              <th>Share</th>
              <th>Who</th>
              <th>Earned by</th>
            </tr>
            <tr>
              <td>Flat rate per challenge</td>
              <td>Challengers</td>
              <td>Having a challenge bought, paid immediately.</td>
            </tr>
            <tr>
              <td>Up to {Math.round(CLAIMANT_SHARE * 100)}%</td>
              <td>Claimant</td>
              <td>A grade built from swing, defense, and calibration.</td>
            </tr>
            <tr>
              <td>{Math.round(CHALLENGER_BASE_SHARE * 100)}%</td>
              <td>Challengers</td>
              <td>Split by how much each bought challenge damaged the defense.</td>
            </tr>
            <tr>
              <td>Up to {Math.round(PATRON_FEE_SHARE * 100)}%</td>
              <td>Patron (you)</td>
              <td>A partial refund, scaled by how much the case moved the audience.</td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}
