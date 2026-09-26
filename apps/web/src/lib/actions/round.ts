"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isValidRoundSelection } from "@quaere/rules";
import { prisma } from "@/lib/db";
import { requireCurrentUser } from "@/lib/auth";
import { postLedgerEntry } from "@/lib/ledger";
import { notify } from "@/lib/notify";
import { checkAndAdvanceCase } from "@/lib/case-transitions";
import { CHALLENGE_PRICE, CHALLENGES_PER_ROUND } from "@/lib/constants";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function joinPool(caseId: string, userId: string): Promise<void> {
  await prisma.caseParticipant.upsert({
    where: { caseId_userId: { caseId, userId } },
    create: { caseId, userId },
    update: {},
  });
}

async function loadCase(bountyId: string) {
  const bounty = await prisma.bounty.findUnique({
    where: { id: bountyId },
    include: { case: true },
  });
  if (!bounty?.case) return null;
  return { bounty, kase: bounty.case };
}

export async function submitChallengeAction(bountyId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId === user.id) fail(path, "You can't challenge your own case.");
  if (kase.stage === "VERDICT" || kase.stage === "FORFEITED") fail(path, "This case is closed.");

  const type = String(formData.get("type") ?? "QUESTION") === "COUNTERFACT" ? "COUNTERFACT" : "QUESTION";
  const text = String(formData.get("text") ?? "").trim();
  const hidden = formData.get("hidden") === "on";
  if (!text) fail(path, "Write the challenge text first.");

  await prisma.$transaction(async (tx) => {
    await tx.challenge.create({
      data: { caseId: kase.id, authorId: user.id, type, text, hidden },
    });
  });
  await joinPool(kase.id, user.id);
  await checkAndAdvanceCase(kase.id);

  revalidatePath(path);
  redirect(path);
}

export async function upvoteChallengeAction(bountyId: string, challengeId: string): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase, bounty } = found;
  if (kase.claimantId === user.id) fail(path, "You can't vote on your own case's challenges.");

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.caseId !== kase.id || challenge.round !== null) {
    fail(path, "That challenge isn't open for upvotes.");
  }
  if (challenge.hidden && bounty.patronId !== user.id) {
    fail(path, "That challenge is hidden.");
  }

  await prisma.challengeUpvote.upsert({
    where: { challengeId_userId: { challengeId, userId: user.id } },
    create: { challengeId, userId: user.id },
    update: {},
  });
  await joinPool(kase.id, user.id);

  revalidatePath(path);
  redirect(path);
}

export async function buyRoundAction(bountyId: string, round: 1 | 2, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase, bounty } = found;
  if (bounty.patronId !== user.id) fail(path, "Only the patron can buy a round.");
  const expectedStage = round === 1 ? "ROUND_1_OPEN" : "ROUND_2_OPEN";
  if (kase.stage !== expectedStage) fail(path, `Round ${round} isn't open for buying right now.`);

  const selectedIds = formData.getAll("challengeId").map(String);
  const open = await prisma.challenge.findMany({
    where: { caseId: kase.id, round: null },
    include: { _count: { select: { upvotes: true } } },
  });
  const openForRules = open.map((c) => ({ id: c.id, upvotes: c._count.upvotes }));

  if (!isValidRoundSelection(selectedIds, openForRules, CHALLENGES_PER_ROUND)) {
    fail(
      path,
      `Pick exactly ${CHALLENGES_PER_ROUND} challenges, including at least one currently top-voted one.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.challenge.updateMany({
      where: { id: { in: selectedIds } },
      data: { round },
    });
    for (const id of selectedIds) {
      const ch = open.find((c) => c.id === id);
      if (ch) {
        await postLedgerEntry(tx, {
          userId: ch.authorId,
          amount: CHALLENGE_PRICE,
          reason: "CHALLENGE_PURCHASE",
          bountyId,
        });
      }
    }
    await tx.case.update({
      where: { id: kase.id },
      data: { stage: round === 1 ? "ROUND_1_DEFENSE" : "ROUND_2_DEFENSE" },
    });
  });

  await notify(
    prisma,
    kase.claimantId,
    "ROUND_OPENED",
    `Round ${round} is bought — ${CHALLENGES_PER_ROUND} challenges are waiting on your defense.`,
    kase.id,
  );

  revalidatePath(path);
  redirect(path);
}

export async function submitDefenseAction(bountyId: string, challengeId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId !== user.id) fail(path, "Only the claimant can respond to a challenge.");

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.caseId !== kase.id || challenge.round == null) {
    fail(path, "That challenge isn't part of an active round.");
  }

  if (challenge.type === "QUESTION") {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) fail(path, "Write an answer first.");
    await prisma.challenge.update({ where: { id: challengeId }, data: { respText: text } });
  } else {
    const mode = String(formData.get("mode") ?? "");
    if (!["REFUTE", "NARROW", "CONCEDE"].includes(mode)) fail(path, "Choose how you're responding.");
    const text = String(formData.get("text") ?? "").trim();
    const source = String(formData.get("source") ?? "").trim();
    const narrowed = String(formData.get("narrowed") ?? "").trim();
    if (mode === "REFUTE" && !source) fail(path, "A refutation needs a source.");
    if (mode === "NARROW" && !narrowed) fail(path, "Write the narrowed claim.");
    await prisma.challenge.update({
      where: { id: challengeId },
      data: {
        respMode: mode as "REFUTE" | "NARROW" | "CONCEDE",
        respText: text || null,
        respSource: mode === "REFUTE" ? source : null,
        respNarrowed: mode === "NARROW" ? narrowed : null,
        // Changing the response invalidates any prior narrowing ruling.
        narrowingRuling: mode === "NARROW" ? challenge.narrowingRuling : null,
      },
    });
  }

  await checkAndAdvanceCase(kase.id);
  revalidatePath(path);
  redirect(path);
}

export async function submitNarrowingRulingAction(bountyId: string, challengeId: string, ruling: "REFINEMENT" | "RETREAT"): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId === user.id) fail(path, "The claimant doesn't rule on their own narrowing.");

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.caseId !== kase.id || challenge.respMode !== "NARROW") {
    fail(path, "That challenge isn't awaiting a narrowing ruling.");
  }

  await prisma.challenge.update({ where: { id: challengeId }, data: { narrowingRuling: ruling } });
  await joinPool(kase.id, user.id);
  await checkAndAdvanceCase(kase.id);

  revalidatePath(path);
  redirect(path);
}

const QUESTION_RULINGS = new Set(["ANSWERED", "PARTIAL", "DODGED"]);
const COUNTERFACT_RULINGS = new Set(["CONVINCING", "NOT_CONVINCING"]);

export async function submitRulingAction(bountyId: string, challengeId: string, formData: FormData): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId === user.id) fail(path, "The claimant doesn't rule on their own case.");

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || challenge.caseId !== kase.id || challenge.round == null) {
    fail(path, "That challenge isn't part of an active round.");
  }

  const value = String(formData.get("value") ?? "");
  const allowed = challenge.type === "QUESTION" ? QUESTION_RULINGS : COUNTERFACT_RULINGS;
  if (!allowed.has(value)) fail(path, "Pick a valid ruling.");

  await prisma.challengeRuling.upsert({
    where: { challengeId_userId: { challengeId, userId: user.id } },
    create: { challengeId, userId: user.id, value: value as never },
    update: { value: value as never },
  });
  await joinPool(kase.id, user.id);
  await checkAndAdvanceCase(kase.id);

  revalidatePath(path);
  redirect(path);
}

export async function castCertaintyVoteAction(
  bountyId: string,
  stage: "OPENING" | "INTERIM" | "FINAL",
  formData: FormData,
): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId === user.id) fail(path, "The claimant doesn't vote on their own case.");

  const sealedField =
    stage === "OPENING" ? kase.openingAudience : stage === "INTERIM" ? kase.interimAudience : kase.finalAudience;
  if (sealedField != null) fail(path, "That vote is already sealed.");

  const value = Math.round(Number(formData.get("value")));
  if (!Number.isFinite(value) || value < 0 || value > 100) fail(path, "Certainty must be 0-100.");

  await prisma.certaintyVote.upsert({
    where: { caseId_stage_userId: { caseId: kase.id, stage, userId: user.id } },
    create: { caseId: kase.id, stage, userId: user.id, value },
    update: { value },
  });
  await joinPool(kase.id, user.id);
  await checkAndAdvanceCase(kase.id);

  revalidatePath(path);
  redirect(path);
}

export async function commitCertaintyAction(
  bountyId: string,
  stage: "INTERIM" | "FINAL",
  formData: FormData,
): Promise<void> {
  const user = await requireCurrentUser();
  const path = `/bounties/${bountyId}`;
  const found = await loadCase(bountyId);
  if (!found) fail(path, "This case doesn't exist yet.");
  const { kase } = found;
  if (kase.claimantId !== user.id) fail(path, "Only the claimant commits their own certainty.");

  const already = stage === "INTERIM" ? kase.interimCertainty : kase.finalCertainty;
  if (already != null) fail(path, "Already committed for this stage.");

  const value = Math.round(Number(formData.get("value")));
  if (!Number.isFinite(value) || value < 0 || value > 100) fail(path, "Certainty must be 0-100.");

  await prisma.case.update({
    where: { id: kase.id },
    data: stage === "INTERIM" ? { interimCertainty: value } : { finalCertainty: value },
  });
  await checkAndAdvanceCase(kase.id);

  revalidatePath(path);
  redirect(path);
}
