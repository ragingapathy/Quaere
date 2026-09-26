import "server-only";
import type { CaseStage } from "@prisma/client";
import {
  challengeDamage,
  resolveCase,
  roundScore as rulesRoundScore,
  trimmedMedian,
  type JuryTally,
} from "@quaere/rules";
import { prisma } from "./db";
import { postLedgerEntry } from "./ledger";
import { notify } from "./notify";
import { CHALLENGE_PRICE, LAPSE_HOURS, QUORUM } from "./constants";

type ChallengeWithRulings = {
  id: string;
  type: "QUESTION" | "COUNTERFACT";
  authorId: string;
  respMode: string | null;
  respText: string | null;
  respSource: string | null;
  respNarrowed: string | null;
  narrowingRuling: string | null;
  rulings: { value: string }[];
};

function tallyFor(ch: ChallengeWithRulings): JuryTally {
  const counts: Record<string, number> = {};
  for (const r of ch.rulings) counts[r.value] = (counts[r.value] ?? 0) + 1;
  return ch.type === "QUESTION"
    ? { answered: counts.ANSWERED ?? 0, partial: counts.PARTIAL ?? 0, dodged: counts.DODGED ?? 0 }
    : { convincing: counts.CONVINCING ?? 0, notConvincing: counts.NOT_CONVINCING ?? 0 };
}

function isAnswered(ch: ChallengeWithRulings): boolean {
  if (ch.type === "QUESTION") return !!ch.respText?.trim();
  if (ch.respMode === "REFUTE") return !!ch.respSource?.trim();
  if (ch.respMode === "NARROW") return !!ch.respNarrowed?.trim() && ch.narrowingRuling != null;
  return ch.respMode === "CONCEDE";
}

/** Have we already sent this exact nudge? Cheap de-dupe so a case that gets
 * viewed 50 times doesn't send 50 identical "quorum reached" notifications. */
async function alreadyNotified(userId: string, caseId: string, type: "QUORUM_REACHED"): Promise<boolean> {
  const existing = await prisma.notification.findFirst({ where: { userId, caseId, type } });
  return existing != null;
}

async function sealStageIfReady(
  c: { id: string; claimantId: string; bounty: { patronId: string } },
  stage: "OPENING" | "INTERIM" | "FINAL",
  nextStage: CaseStage,
  claimantCommit: number | null,
): Promise<boolean> {
  const votes = await prisma.certaintyVote.findMany({ where: { caseId: c.id, stage } });
  if (votes.length < QUORUM) return false;

  if (claimantCommit == null) {
    if (!(await alreadyNotified(c.claimantId, c.id, "QUORUM_REACHED"))) {
      await notify(
        prisma,
        c.claimantId,
        "QUORUM_REACHED",
        `The ${stage.toLowerCase()} vote has reached quorum (${votes.length} voters) — commit your certainty to reveal it.`,
        c.id,
      );
    }
    // Set-once: only stamps the deadline the first time quorum is seen
    // reached, so repeated page views don't keep pushing it forward.
    await prisma.case.updateMany({
      where: { id: c.id, awaitingClaimantSince: null },
      data: { awaitingClaimantSince: new Date() },
    });
    return false;
  }

  const median = trimmedMedian(votes.map((v) => v.value));
  const field =
    stage === "OPENING" ? "openingAudience" : stage === "INTERIM" ? "interimAudience" : "finalAudience";
  await prisma.case.update({
    where: { id: c.id },
    data: { [field]: median, stage: nextStage, awaitingClaimantSince: null },
  });

  await notify(
    prisma,
    c.claimantId,
    "ROUND_OPENED",
    `Your ${stage.toLowerCase()} vote sealed at ${Math.round(median)}%.`,
    c.id,
  );
  await notify(
    prisma,
    c.bounty.patronId,
    "ROUND_OPENED",
    `The ${stage.toLowerCase()} vote on your case sealed at ${Math.round(median)}%.`,
    c.id,
  );
  return true;
}

async function closeRoundIfSettled(
  c: { id: string; claimantId: string; currentClaim: string; wasNarrowed: boolean; wasRetreat: boolean; bounty: { patronId: string } },
  round: 1 | 2,
  nextStage: CaseStage,
): Promise<boolean> {
  const challenges = await prisma.challenge.findMany({
    where: { caseId: c.id, round },
    include: { rulings: true },
  });
  if (challenges.length === 0) return false;

  for (const ch of challenges) {
    if (ch.rulings.length < QUORUM) return false;
    if (!isAnswered(ch)) return false;
  }

  let currentClaim = c.currentClaim;
  let wasNarrowed = c.wasNarrowed;
  let wasRetreat = c.wasRetreat;
  for (const ch of challenges) {
    if (
      ch.type === "COUNTERFACT" &&
      ch.respMode === "NARROW" &&
      ch.respNarrowed &&
      ch.respNarrowed.trim() !== currentClaim.trim()
    ) {
      const text = ch.respNarrowed.trim();
      await prisma.claimNarrowing.upsert({
        where: { challengeId: ch.id },
        create: { caseId: c.id, challengeId: ch.id, round, text },
        update: {},
      });
      currentClaim = text;
      wasNarrowed = true;
      if (ch.narrowingRuling === "RETREAT") wasRetreat = true;
    }
  }

  await prisma.case.update({
    where: { id: c.id },
    data: { currentClaim, wasNarrowed, wasRetreat, stage: nextStage, awaitingClaimantSince: null },
  });

  await notify(prisma, c.claimantId, "ROUND_CLOSED", `Round ${round} closed.`, c.id);
  await notify(prisma, c.bounty.patronId, "ROUND_CLOSED", `Round ${round} closed on your case.`, c.id);
  return true;
}

async function sealFinalAndResolve(c: {
  id: string;
  bountyId: string;
  claimantId: string;
  openingCertainty: number;
  interimCertainty: number | null;
  finalCertainty: number | null;
  openingAudience: number | null;
  interimAudience: number | null;
  wasNarrowed: boolean;
  wasRetreat: boolean;
  bounty: { patronId: string; amount: number };
}): Promise<boolean> {
  const votes = await prisma.certaintyVote.findMany({ where: { caseId: c.id, stage: "FINAL" } });
  if (votes.length < QUORUM) return false;

  if (c.finalCertainty == null) {
    if (!(await alreadyNotified(c.claimantId, c.id, "QUORUM_REACHED"))) {
      await notify(
        prisma,
        c.claimantId,
        "QUORUM_REACHED",
        `The final vote has reached quorum (${votes.length} voters) — commit your certainty to reveal the verdict.`,
        c.id,
      );
    }
    await prisma.case.updateMany({
      where: { id: c.id, awaitingClaimantSince: null },
      data: { awaitingClaimantSince: new Date() },
    });
    return false;
  }
  if (c.openingAudience == null || c.interimAudience == null || c.interimCertainty == null) return false;

  const finalAudience = trimmedMedian(votes.map((v) => v.value));

  const [round1, round2] = await Promise.all([
    prisma.challenge.findMany({ where: { caseId: c.id, round: 1 }, include: { rulings: true } }),
    prisma.challenge.findMany({ where: { caseId: c.id, round: 2 }, include: { rulings: true } }),
  ]);
  const allBought = [...round1, ...round2];

  const scored = (list: ChallengeWithRulings[]) =>
    list.map((ch) => ({
      id: ch.id,
      authorId: ch.authorId,
      type: (ch.type === "QUESTION" ? "question" : "counterfact") as "question" | "counterfact",
      tally: tallyFor(ch),
    }));

  const result = resolveCase({
    bountyAmount: c.bounty.amount,
    challengePrice: CHALLENGE_PRICE,
    boughtChallenges: allBought.map((ch) => ({
      id: ch.id,
      authorId: ch.authorId,
      damage: challengeDamage(tallyFor(ch)),
    })),
    openingCertainty: { claimant: c.openingCertainty, audience: c.openingAudience },
    interimCertainty: { claimant: c.interimCertainty, audience: c.interimAudience },
    finalCertainty: { claimant: c.finalCertainty, audience: finalAudience },
    round1Score: rulesRoundScore(scored(round1)),
    round2Score: rulesRoundScore(scored(round2)),
    wasNarrowed: c.wasNarrowed,
    wasRetreat: c.wasRetreat,
  });

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: c.id },
      data: {
        finalAudience,
        stage: "VERDICT",
        awaitingClaimantSince: null,
        verdict: result.verdict.toUpperCase() as
          | "UPHELD"
          | "AMENDED"
          | "UNMOVED"
          | "OVERTURNED"
          | "FORFEITED",
        gradeSwing: result.grade.swing,
        gradeDefense: result.grade.defense,
        gradeCalibration: result.grade.calibration,
        grade: result.grade.grade,
        resolvedAt: new Date(),
      },
    });

    await postLedgerEntry(tx, {
      userId: c.claimantId,
      amount: result.escrow.claimantPayout,
      reason: "CASE_PAYOUT_CLAIMANT",
      bountyId: c.bountyId,
    });
    await postLedgerEntry(tx, {
      userId: c.bounty.patronId,
      amount: result.escrow.patronPayout,
      reason: "CASE_PAYOUT_PATRON",
      bountyId: c.bountyId,
    });
    for (const share of result.escrow.challengerShares) {
      // share.purchasePay was already paid out at buy time (buyRound); only
      // the pool share (damage-weighted) is settled here at the verdict.
      if (share.poolPay <= 0) continue;
      const author = allBought.find((b) => b.id === share.challengeId)?.authorId;
      if (!author) continue;
      await postLedgerEntry(tx, {
        userId: author,
        amount: share.poolPay,
        reason: "CASE_PAYOUT_CHALLENGER",
        bountyId: c.bountyId,
      });
    }
  });

  await notify(
    prisma,
    c.claimantId,
    "VERDICT_READY",
    `Verdict: ${result.verdict}. Your grade: ${Math.round(result.grade.grade)} of 100.`,
    c.id,
  );
  await notify(prisma, c.bounty.patronId, "VERDICT_READY", `Verdict on your case: ${result.verdict}.`, c.id);
  const participants = await prisma.caseParticipant.findMany({ where: { caseId: c.id } });
  for (const p of participants) {
    if (p.userId === c.claimantId || p.userId === c.bounty.patronId) continue;
    await notify(prisma, p.userId, "VERDICT_READY", `Verdict is in on a case you took part in: ${result.verdict}.`, c.id);
  }
  return true;
}

/** Has the claimant done their own part for the stage that's waiting on
 * them? True for any stage that doesn't wait on the claimant at all — a
 * lapse can only be declared on a stage this can meaningfully answer "no"
 * for. A round with slow jurors but a claimant who answered everything is
 * not a lapse; only a genuinely quiet claimant is. */
async function claimantHasActed(c: {
  id: string;
  stage: CaseStage;
  interimCertainty: number | null;
  finalCertainty: number | null;
}): Promise<boolean> {
  if (c.stage === "ROUND_1_DEFENSE" || c.stage === "ROUND_2_DEFENSE") {
    const round = c.stage === "ROUND_1_DEFENSE" ? 1 : 2;
    const challenges = await prisma.challenge.findMany({ where: { caseId: c.id, round } });
    return challenges.length > 0 && challenges.every((ch) => isAnswered({ ...ch, rulings: [] }));
  }
  if (c.stage === "AWAITING_INTERIM_VOTE") return c.interimCertainty != null;
  if (c.stage === "AWAITING_FINAL_VOTE") return c.finalCertainty != null;
  return true;
}

/** Freezes a case whose claimant has gone quiet for LAPSE_HOURS past the
 * moment they were last on the hook — clearing claimantId but touching
 * nothing else (bought challenges, rulings, votes all stand as they are)
 * so a new claimant can adopt it exactly where the old one left off. */
async function freezeIfLapsed(c: {
  id: string;
  claimantId: string | null;
  frozenAt: Date | null;
  awaitingClaimantSince: Date | null;
  stage: CaseStage;
  interimCertainty: number | null;
  finalCertainty: number | null;
  bounty: { patronId: string };
}): Promise<boolean> {
  if (c.frozenAt || !c.claimantId || !c.awaitingClaimantSince) return false;
  const elapsedMs = Date.now() - c.awaitingClaimantSince.getTime();
  if (elapsedMs < LAPSE_HOURS * 3600_000) return false;
  if (await claimantHasActed(c)) return false;

  await prisma.case.update({
    where: { id: c.id },
    data: {
      frozenAt: new Date(),
      claimantId: null,
      barredClaimantIds: { push: c.claimantId },
    },
  });

  await notify(
    prisma,
    c.bounty.patronId,
    "CASE_FROZEN",
    "Your claimant went quiet — the case is frozen, open for someone else to adopt.",
    c.id,
  );
  const participants = await prisma.caseParticipant.findMany({ where: { caseId: c.id } });
  for (const p of participants) {
    await notify(prisma, p.userId, "CASE_FROZEN", "A case you're following is frozen, waiting on a new claimant.", c.id);
  }
  return true;
}

async function tryAdvanceOnce(caseId: string): Promise<boolean> {
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: { bounty: true } });
  if (!c) return false;
  if (c.frozenAt) return false; // nothing moves again until someone adopts it
  if (await freezeIfLapsed(c)) return true;
  if (!c.claimantId) return false; // shouldn't happen outside the frozen states above

  const claimantId = c.claimantId;
  switch (c.stage) {
    case "AWAITING_OPENING_VOTE":
      return sealStageIfReady({ ...c, claimantId }, "OPENING", "ROUND_1_OPEN", c.openingCertainty);
    case "ROUND_1_DEFENSE":
      return closeRoundIfSettled({ ...c, claimantId }, 1, "AWAITING_INTERIM_VOTE");
    case "AWAITING_INTERIM_VOTE":
      return sealStageIfReady({ ...c, claimantId }, "INTERIM", "ROUND_2_OPEN", c.interimCertainty);
    case "ROUND_2_DEFENSE":
      return closeRoundIfSettled({ ...c, claimantId }, 2, "AWAITING_FINAL_VOTE");
    case "AWAITING_FINAL_VOTE":
      return sealFinalAndResolve({ ...c, claimantId });
    default:
      return false;
  }
}

/**
 * Lazily advances a case's stage as far as it currently can go — sealing a
 * certainty vote, settling a round, or resolving the verdict — with no
 * scheduler or cron job behind it. Call this at the top of any request that
 * reads a case; state changes the instant someone looks, not on a timer.
 * Loops because one seal can immediately unlock the next (e.g. a round with
 * nothing left to rule on right as the final vote already has quorum).
 */
export async function checkAndAdvanceCase(caseId: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const advanced = await tryAdvanceOnce(caseId);
    if (!advanced) return;
  }
}
