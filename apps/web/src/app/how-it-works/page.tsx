export const metadata = { title: "How it works — Quaere" };

export default function HowItWorksPage() {
  return (
    <>
      <section className="sheet">
        <h1>How Quaere works</h1>
        <p className="lede">
          A patron funds a case. A claimant stakes a claim and a certainty. The audience challenges
          it, judges every response, and votes twice — once before the case, once after. The
          claimant is paid for how far the room moved, not for ending in agreement.
        </p>
      </section>

      {/* Explainer video goes here — replace this placeholder with a real
          <video> or embed once it exists. Keep the surrounding .sheet so the
          spacing matches the rest of the page. */}
      <section className="sheet quiet">
        <div
          style={{
            border: "1px dashed var(--rule)",
            borderRadius: 4,
            padding: 40,
            textAlign: "center",
            background: "var(--tint)",
          }}
        >
          <p className="small muted" style={{ margin: 0 }}>
            Explainer video coming soon.
          </p>
        </div>
      </section>

      <section className="sheet quiet">
        <h2>The roles</h2>
        <p className="small">
          <b>Patron</b> — funds the case, and chooses which challenges the claimant must face. Can't
          judge answers; scoring comes from a formula and the audience, never the patron's
          preference. A patron always nets a partial loss on their own escrow — the role is meant to
          spend cred, not accumulate it.
        </p>
        <p className="small">
          <b>Claimant</b> — makes the claim, states how sure they are, and defends it across two
          rounds of challenges. Barred from acting as audience on their own case: no voting, no
          submitting challenges, no seeing the open pool before it's bought.
        </p>
        <p className="small">
          <b>Audience</b> — challenges the claim, rules on every response, and votes on certainty
          twice. No arguing required. Anyone whose challenge is bought earns cred immediately;
          more is earned from how much damage that challenge did to the defense.
        </p>
      </section>

      <section className="sheet quiet">
        <h2>A case, start to finish</h2>
        <ol style={{ paddingLeft: 20 }}>
          <li className="small">A patron posts a bounty on a topic.</li>
          <li className="small">Claimants answer the call with their own claim and a certainty; the patron picks one.</li>
          <li className="small">The audience votes on the opening certainty.</li>
          <li className="small">The patron buys 5 challenges for round 1 — the top-voted open one must be included.</li>
          <li className="small">The claimant answers each: a question gets answered directly; a counterfact gets refuted with a source, narrowed, or conceded.</li>
          <li className="small">The audience rules on every response, and votes again.</li>
          <li className="small">Round 2 repeats the same shape, usually following up on what round 1 raised.</li>
          <li className="small">A final, sealed vote — then the verdict: Upheld, Amended, Unmoved, or Overturned, always shown with the real swing.</li>
        </ol>
      </section>

      <section className="sheet quiet">
        <h2>Why 9</h2>
        <p className="small">
          A certainty vote seals, and a challenge's ruling settles, once 9 independent people have
          weighed in — the same size as the U.S. Supreme Court bench. One number, used everywhere
          the game needs enough distinct judgment to trust a result.
        </p>
      </section>

      <section className="sheet quiet">
        <h2>The Record</h2>
        <p className="small">
          Every case, win or lose, adds to a Record: an accumulating file of every attempt made on
          that claim. A case's summary is generated mechanically from its own recorded facts —
          never written by a participant with a stake in how it's remembered.
        </p>
      </section>
    </>
  );
}
