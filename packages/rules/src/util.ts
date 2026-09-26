export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Largest-remainder apportionment: split `total` integer units across
 * non-negative `weights` so shares sum to exactly `total`, ties broken by
 * largest weight first. Used to divide the challenger pool without losing
 * or inventing a single point of cred to rounding. */
export function apportion(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    // No signal to weight by: split as evenly as possible.
    const base = Math.floor(total / weights.length);
    const shares = weights.map(() => base);
    let rem = total - base * weights.length;
    for (let i = 0; rem > 0; i = (i + 1) % weights.length, rem--) {
      shares[i] = shares[i]! + 1;
    }
    return shares;
  }
  const raw = weights.map((w) => (total * w) / sum);
  const shares = raw.map(Math.floor);
  let rem = total - shares.reduce((a, b) => a + b, 0);
  const order = weights
    .map((w, i) => i)
    .sort((a, b) => weights[b]! - weights[a]!);
  for (let i = 0; rem > 0; i = (i + 1) % order.length, rem--) {
    const idx = order[i]!;
    shares[idx] = shares[idx]! + 1;
  }
  return shares;
}
