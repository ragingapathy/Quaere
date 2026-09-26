import { clamp } from "./util";

/**
 * Calibration score (0-100): how close the claimant's committed certainty
 * was to the audience's own number at the same checkpoint. Ported from the
 * v2 prototype's `cal`. Either side missing (not yet committed/revealed)
 * scores 0 rather than throwing, since callers may compute this
 * speculatively before both numbers exist.
 */
export function calibration(
  stated: number | null,
  audience: number | null,
): number {
  if (stated == null || audience == null) return 0;
  return Math.max(0, Math.round(100 - 4 * Math.abs(stated - audience)));
}

export { clamp };
