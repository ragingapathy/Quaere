import { prisma } from "./db";

/**
 * Everything the player page shows, per the Decision Log: tenure and
 * activity only, no bio/photo/demographics. Average calibration as
 * claimant gets its own line because it measures something a win count
 * can't. No win-rate badge — verdict counts are shown as plain information,
 * never rolled into a derived win percentage, since that would reward
 * chasing agreement over genuine testing. Tip stats are aggregates only,
 * never itemized.
 */

/** Ledger reasons that represent actually earning cred through play, as
 * opposed to a grant, a refund of your own money, or a transfer. */
const EARNED_REASONS = ["TIP_RECEIVED", "CHALLENGE_PURCHASE", "CASE_PAYOUT_CLAIMANT", "CASE_PAYOUT_CHALLENGER"] as const;

export async function getPlayerStats(username: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return null;

  const [
    bountiesPosted,
    casesAsClaimant,
    resolvedAsClaimant,
    participantCases,
    walkedAwayCount,
    earnedAgg,
    tipsReceivedAgg,
    tipsSentAgg,
  ] = await Promise.all([
    prisma.bounty.count({ where: { patronId: user.id } }),
    prisma.case.count({ where: { claimantId: user.id } }),
    prisma.case.findMany({
      where: { claimantId: user.id, grade: { not: null } },
      select: { verdict: true, gradeCalibration: true },
    }),
    prisma.caseParticipant.count({ where: { userId: user.id } }),
    prisma.case.count({ where: { barredClaimantIds: { has: user.id } } }),
    prisma.ledgerEntry.aggregate({
      where: { userId: user.id, reason: { in: [...EARNED_REASONS] } },
      _sum: { amount: true },
    }),
    prisma.tip.aggregate({ where: { recipientId: user.id }, _sum: { amount: true } }),
    prisma.tip.aggregate({ where: { senderId: user.id }, _sum: { amount: true } }),
  ]);

  const calibrations = resolvedAsClaimant
    .map((c) => c.gradeCalibration)
    .filter((v): v is number => v != null);
  const avgCalibration = calibrations.length
    ? calibrations.reduce((a, b) => a + b, 0) / calibrations.length
    : null;

  const verdictCounts: Partial<Record<string, number>> = {};
  for (const c of resolvedAsClaimant) {
    if (c.verdict) verdictCounts[c.verdict] = (verdictCounts[c.verdict] ?? 0) + 1;
  }

  const lifetimeEarned = earnedAgg._sum.amount ?? 0;
  const totalTipsReceived = tipsReceivedAgg._sum.amount ?? 0;
  const totalTipsSent = tipsSentAgg._sum.amount ?? 0;

  return {
    user,
    bountiesPosted,
    casesAsClaimant,
    resolvedCasesAsClaimant: resolvedAsClaimant.length,
    participantCases,
    walkedAwayCount,
    avgCalibration,
    verdictCounts,
    tipReceivedPctOfLifetime: lifetimeEarned > 0 ? (totalTipsReceived / lifetimeEarned) * 100 : 0,
    totalTipsSent,
  };
}

export type PlayerStats = NonNullable<Awaited<ReturnType<typeof getPlayerStats>>>;
