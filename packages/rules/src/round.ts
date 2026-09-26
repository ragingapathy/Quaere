/**
 * Which open challenges are eligible for "top-voted" status (ties count as
 * top-voted; that's the audience's strongest signal, and the patron can't
 * dodge it by only buying one of several tied leaders).
 */
export function topVotedChallengeIds(
  open: readonly { id: string; upvotes: number }[],
): string[] {
  if (open.length === 0) return [];
  const max = Math.max(...open.map((c) => c.upvotes));
  return open.filter((c) => c.upvotes === max).map((c) => c.id);
}

/**
 * A round's challenge purchase is valid only if the patron bought exactly
 * the configured count and included at least one top-voted challenge
 * (Design Bible, Section 3): the patron can't dodge the audience's
 * strongest objection.
 */
export function isValidRoundSelection(
  selectedIds: readonly string[],
  open: readonly { id: string; upvotes: number }[],
  challengesPerRound: number,
): boolean {
  if (selectedIds.length !== challengesPerRound) return false;
  const top = topVotedChallengeIds(open);
  return selectedIds.some((id) => top.includes(id));
}
