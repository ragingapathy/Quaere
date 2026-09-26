import { prisma } from "./db";

/**
 * Registration is the only place cred is ever created (STARTING_GRANT
 * ledger entries) — everything else just reshuffles cred that already
 * exists between wallets and open escrow. These stats exist so that's
 * visible, not just asserted: totalInWallets + totalEscrowed should always
 * equal totalMinted, since nothing else mints or burns cred yet.
 */
export interface EconomyStats {
  totalUsers: number;
  totalMinted: number;
  totalInWallets: number;
  totalEscrowed: number;
  bountiesPosted: number;
  openBounties: number;
  casesRunning: number;
  totalApplications: number;
  largestOpenBounty: number | null;
  /** Transparency mitigation for tip-based laundering (Decision Log's own
   * answer to the analogous vote-sybil risk: surface it, don't just trust
   * the gate/caps): total ever tipped, how many tips, and what share of all
   * minted cred has moved as a tip rather than through play. */
  totalTipped: number;
  tipCount: number;
  tipShareOfMintedPct: number;
}

export async function getEconomyStats(): Promise<EconomyStats> {
  const [
    totalUsers,
    mintedAgg,
    walletsAgg,
    escrowedAgg,
    bountiesPosted,
    openBounties,
    casesRunning,
    totalApplications,
    largestOpenBountyAgg,
    tipAgg,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.ledgerEntry.aggregate({ where: { reason: "STARTING_GRANT" }, _sum: { amount: true } }),
    prisma.user.aggregate({ _sum: { balance: true } }),
    prisma.bounty.aggregate({
      where: { status: { in: ["OPEN", "CLAIMED"] } },
      _sum: { amount: true },
    }),
    prisma.bounty.count(),
    prisma.bounty.count({ where: { status: "OPEN" } }),
    prisma.case.count(),
    prisma.application.count(),
    prisma.bounty.aggregate({ where: { status: "OPEN" }, _max: { amount: true } }),
    prisma.tip.aggregate({ _sum: { amount: true }, _count: true }),
  ]);

  const totalMinted = mintedAgg._sum.amount ?? 0;
  const totalTipped = tipAgg._sum.amount ?? 0;

  return {
    totalUsers,
    totalMinted,
    totalInWallets: walletsAgg._sum.balance ?? 0,
    totalEscrowed: escrowedAgg._sum.amount ?? 0,
    bountiesPosted,
    openBounties,
    casesRunning,
    totalApplications,
    largestOpenBounty: largestOpenBountyAgg._max.amount,
    totalTipped,
    tipCount: tipAgg._count,
    tipShareOfMintedPct: totalMinted > 0 ? (totalTipped / totalMinted) * 100 : 0,
  };
}
