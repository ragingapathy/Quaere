import "server-only";
import { prisma } from "./db";
import { MAX_TIP_AMOUNT, TIP_DAILY_CAP_PER_SENDER, TIP_LIFETIME_CAP_PER_PAIR } from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Has this account actually played, in a role the game can currently
 * verify? A fresh account can mint cred at registration but can't tip it
 * out until it's crossed a real state transition the game gates on
 * someone else's judgment: being chosen as a claimant, or having a bounty
 * you posted actually claimed.
 *
 * This is a partial mitigation, not a solved one: round play (challenges,
 * audience votes, verdicts) isn't built yet, so today "played" only reaches
 * as far as the bounty board. Once challenges and quorum voting exist, a
 * bought-and-judged challenge should count here too. Two sockpuppets could
 * still satisfy this today by having one apply to the other's bounty and
 * self-select — that's the same sybil risk the Decision Log already parks
 * for vote manipulation, not a new hole this introduces, and it at least
 * requires operating two accounts through a real, logged state change
 * rather than tipping the instant a single account registers.
 */
export async function hasParticipated(userId: string): Promise<boolean> {
  const [selectedApplication, claimedBounty] = await Promise.all([
    prisma.application.findFirst({ where: { claimantId: userId, status: "SELECTED" } }),
    prisma.bounty.findFirst({ where: { patronId: userId, status: "CLAIMED" } }),
  ]);
  return selectedApplication != null || claimedBounty != null;
}

export type TipLimitCheck = { ok: true } | { ok: false; reason: string };

/** Per-tip size, a rolling 24h cap per sender, and a lifetime cap on any one
 * sender→recipient pair, so a single relationship can't be used to funnel
 * unlimited cred across many small tips over time. */
export async function checkTipLimits(
  senderId: string,
  recipientId: string,
  amount: number,
): Promise<TipLimitCheck> {
  if (amount > MAX_TIP_AMOUNT) {
    return { ok: false, reason: `A single tip can't exceed ${MAX_TIP_AMOUNT} cred.` };
  }

  const since = new Date(Date.now() - DAY_MS);
  const dailyAgg = await prisma.tip.aggregate({
    where: { senderId, createdAt: { gte: since } },
    _sum: { amount: true },
  });
  const sentToday = dailyAgg._sum.amount ?? 0;
  if (sentToday + amount > TIP_DAILY_CAP_PER_SENDER) {
    return {
      ok: false,
      reason: `You've already tipped ${sentToday} cred in the last 24 hours; this would put you over the ${TIP_DAILY_CAP_PER_SENDER} cred daily cap.`,
    };
  }

  const pairAgg = await prisma.tip.aggregate({
    where: { senderId, recipientId },
    _sum: { amount: true },
  });
  const sentToRecipientEver = pairAgg._sum.amount ?? 0;
  if (sentToRecipientEver + amount > TIP_LIFETIME_CAP_PER_PAIR) {
    return {
      ok: false,
      reason: `You've already tipped this person ${sentToRecipientEver} cred lifetime; this would put you over the ${TIP_LIFETIME_CAP_PER_PAIR} cred cap between any two accounts.`,
    };
  }

  return { ok: true };
}
