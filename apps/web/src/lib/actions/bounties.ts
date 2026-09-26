"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { postLedgerEntry } from "@/lib/ledger";
import { CHALLENGES_PER_ROUND } from "@/lib/constants";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

export async function postBountyAction(formData: FormData): Promise<void> {
  const user = await requireCurrentUser();

  const topic = String(formData.get("topic") ?? "").trim();
  const amount = Math.floor(Number(formData.get("amount")));

  if (!topic) fail("/bounties/new", "The bounty needs a topic.");
  if (!Number.isFinite(amount) || amount <= 0) {
    fail("/bounties/new", "Bounty amount must be a positive number of cred.");
  }
  if (amount > user.balance) {
    fail("/bounties/new", `You only have ${user.balance} cred to fund a bounty with.`);
  }

  const bounty = await prisma.$transaction(async (tx) => {
    const created = await tx.bounty.create({
      data: {
        topic,
        amount,
        challengesPerRound: CHALLENGES_PER_ROUND,
        patronId: user.id,
      },
    });
    await postLedgerEntry(tx, {
      userId: user.id,
      amount: -amount,
      reason: "BOUNTY_ESCROW",
      bountyId: created.id,
    });
    return created;
  });

  redirect(`/bounties/${bounty.id}`);
}

/** Anyone can add to a frozen case's bounty to entice someone to adopt it.
 * No burn, same spirit as tipping: the cred goes straight into the pool the
 * eventual verdict pays out of. */
export async function topUpBountyAction(bountyId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;

  const bounty = await prisma.bounty.findUnique({ where: { id: bountyId }, include: { case: true } });
  if (!bounty) fail(path, "This bounty no longer exists.");
  if (!bounty.case?.frozenAt) fail(path, "Top-ups are only for a case that's frozen, awaiting a new claimant.");

  const amount = Math.floor(Number(formData.get("amount")));
  if (!Number.isFinite(amount) || amount <= 0) fail(path, "Top-up must be a positive number of cred.");
  if (amount > user.balance) fail(path, `You only have ${user.balance} cred.`);

  await prisma.$transaction(async (tx) => {
    await tx.bounty.update({ where: { id: bountyId }, data: { amount: { increment: amount } } });
    await tx.bountyContribution.create({ data: { bountyId, contributorId: user.id, amount } });
    await postLedgerEntry(tx, { userId: user.id, amount: -amount, reason: "BOUNTY_TOPUP", bountyId });
  });

  revalidatePath(path);
  redirect(path);
}

export async function applyToBountyAction(bountyId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const detailPath = `/bounties/${bountyId}`;

  const bounty = await prisma.bounty.findUnique({ where: { id: bountyId } });
  if (!bounty) fail(detailPath, "This bounty no longer exists.");
  if (bounty.status !== "OPEN") fail(detailPath, "This bounty is no longer open for applicants.");
  if (bounty.patronId === user.id) {
    fail(detailPath, "You can't answer your own call — patrons don't play their own case.");
  }

  const claimText = String(formData.get("claimText") ?? "").trim();
  const certainty = Math.round(Number(formData.get("certainty")));

  if (!claimText) fail(detailPath, "State the claim you're staking.");
  if (!Number.isFinite(certainty) || certainty < 0 || certainty > 100) {
    fail(detailPath, "Certainty must be between 0 and 100.");
  }

  await prisma.application.upsert({
    where: { bountyId_claimantId: { bountyId, claimantId: user.id } },
    create: { bountyId, claimantId: user.id, claimText, certainty },
    update: { claimText, certainty },
  });

  revalidatePath(detailPath);
  redirect(detailPath);
}

export async function withdrawApplicationAction(bountyId: string): Promise<void> {
  const user = await requireCurrentUser();
  await prisma.application.deleteMany({
    where: { bountyId, claimantId: user.id, status: "PENDING" },
  });
  revalidatePath(`/bounties/${bountyId}`);
  redirect(`/bounties/${bountyId}`);
}

export async function selectClaimantAction(
  bountyId: string,
  applicationId: string,
): Promise<void> {
  const user = await requireCurrentUser();
  const detailPath = `/bounties/${bountyId}`;

  const bounty = await prisma.bounty.findUnique({ where: { id: bountyId } });
  if (!bounty) fail(detailPath, "Bounty not found.");
  if (bounty.patronId !== user.id) fail(detailPath, "Only the patron can choose a claimant.");
  if (bounty.status !== "OPEN") fail(detailPath, "This bounty is already claimed.");

  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application || application.bountyId !== bountyId || application.status !== "PENDING") {
    fail(detailPath, "That application is no longer available.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({
      where: { id: application.id },
      data: { status: "SELECTED" },
    });
    await tx.application.updateMany({
      where: { bountyId, id: { not: application.id }, status: "PENDING" },
      data: { status: "DECLINED" },
    });
    await tx.bounty.update({ where: { id: bountyId }, data: { status: "CLAIMED" } });
    await tx.case.create({
      data: {
        bountyId,
        claimantId: application.claimantId,
        originalClaim: application.claimText,
        currentClaim: application.claimText,
        openingCertainty: application.certainty,
      },
    });
  });

  revalidatePath(detailPath);
  redirect(detailPath);
}
