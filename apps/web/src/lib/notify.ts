import "server-only";
import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function notify(
  tx: Tx,
  userId: string,
  type: NotificationType,
  message: string,
  caseId?: string,
): Promise<void> {
  await tx.notification.create({ data: { userId, type, message, caseId } });
}
