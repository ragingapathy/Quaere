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
  ]);

  return {
    totalUsers,
    totalMinted: mintedAgg._sum.amount ?? 0,
    totalInWallets: walletsAgg._sum.balance ?? 0,
    totalEscrowed: escrowedAgg._sum.amount ?? 0,
    bountiesPosted,
    openBounties,
    casesRunning,
    totalApplications,
    largestOpenBounty: largestOpenBountyAgg._max.amount,
  };
}
