/**
 * Audience certainty is the trimmed median of individual votes (Design
 * Bible, Section 3): the highest and lowest are dropped before taking the
 * median, so one troll or one starstruck vote can't move the number alone.
 * Ported from the v2 prototype's `tmedian`.
 */
export function trimmedMedian(votes: readonly number[]): number {
  if (votes.length === 0) {
    throw new Error("trimmedMedian: at least one vote is required");
  }
  const sorted = [...votes].sort((a, b) => a - b);
  const trimmed = sorted.length >= 5 ? sorted.slice(1, -1) : sorted;
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2
    ? trimmed[mid]!
    : (trimmed[mid - 1]! + trimmed[mid]!) / 2;
}
