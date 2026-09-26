"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { postLedgerEntry } from "@/lib/ledger";
import { hasParticipated, checkTipLimits } from "@/lib/tipping";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function tipAction(
  recipientId: string,
  returnPath: string,
  formData: FormData,
): Promise<void> {
  const sender = await requireCurrentUser();

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) fail(returnPath, "That account no longer exists.");
  if (recipient.id === sender.id) fail(returnPath, "You can't tip yourself.");

  const amount = Math.floor(Number(formData.get("amount")));
  const noteRaw = String(formData.get("note") ?? "").trim();
  const note = noteRaw.slice(0, 140) || null;
  const bountyId = String(formData.get("bountyId") ?? "").trim() || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    fail(returnPath, "Tip amount must be a positive number of cred.");
  }
  if (amount > sender.balance) {
    fail(returnPath, `You only have ${sender.balance} cred.`);
  }

  if (!(await hasParticipated(sender.id))) {
    fail(
      returnPath,
      "Tipping is locked until you've actually played a case — either been chosen as a claimant, or had a bounty you posted get claimed. This keeps a fresh account from minting cred at registration and immediately handing it off.",
    );
  }

  const limitCheck = await checkTipLimits(sender.id, recipient.id, amount);
  if (!limitCheck.ok) fail(returnPath, limitCheck.reason);

  await prisma.$transaction(async (tx) => {
    await postLedgerEntry(tx, {
      userId: sender.id,
      amount: -amount,
      reason: "TIP_SENT",
      bountyId: bountyId ?? undefined,
    });
    await postLedgerEntry(tx, {
      userId: recipient.id,
      amount,
      reason: "TIP_RECEIVED",
      bountyId: bountyId ?? undefined,
    });
    await tx.tip.create({
      data: {
        senderId: sender.id,
        recipientId: recipient.id,
        amount,
        note,
        bountyId,
      },
    });
  });

  revalidatePath(returnPath);
  redirect(returnPath);
}
