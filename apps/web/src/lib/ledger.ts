import "server-only";
import type { LedgerReason, Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Every cred movement goes through here: it updates the balance and writes
 * the LedgerEntry in the same transaction, so a balance is always the sum
 * of its ledger rather than an independently-mutated number. Throws if a
 * debit would take the balance negative — callers should check affordability
 * with a friendlier message before calling this, but this is the backstop.
 */
export async function postLedgerEntry(
  tx: Tx,
  input: { userId: string; amount: number; reason: LedgerReason; bountyId?: string },
) {
  const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId } });
  const nextBalance = user.balance + input.amount;
  if (nextBalance < 0) {
    throw new Error("Insufficient balance");
  }
  await tx.user.update({ where: { id: input.userId }, data: { balance: nextBalance } });
  await tx.ledgerEntry.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      bountyId: input.bountyId,
    },
  });
}
