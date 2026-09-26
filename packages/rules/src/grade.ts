import { clamp } from "./util";

/** Points of opening-to-final swing that earn full marks on the swing
 * component of the grade. */
export const SWING_FULL_MARKS_POINTS = 20;

/** A narrowing the audience rules a retreat (rather than a valid
 * refinement) caps the swing component at the same value a claim that moved
 * nobody at all would score — it is a cap, never a cred deduction, and
 * defense/calibration score normally underneath it (Decision Log). */
export const RETREAT_SWING_CAP = 50;

export const GRADE_WEIGHTS = {
  swing: 0.45,
  defense: 0.4,
  calibration: 0.15,
} as const;

/** The swing component of the grade (0-100), before any retreat cap. */
export function swingScore(openingCertainty: number, finalCertainty: number): number {
  const swing = finalCertainty - openingCertainty;
  return clamp(50 + (50 / SWING_FULL_MARKS_POINTS) * swing, 0, 100);
}

export function applyRetreatCap(swingComponent: number, wasRetreat: boolean): number {
  return wasRetreat ? Math.min(swingComponent, RETREAT_SWING_CAP) : swingComponent;
}

export interface GradeBreakdown {
  /** Swing component, 0-100, after any retreat cap. */
  swing: number;
  /** Defense component, 0-100: average round score across both rounds. */
  defense: number;
  /** Calibration component, 0-100: average calibration across every
   * checkpoint where the audience number was revealed. */
  calibration: number;
  /** Final weighted grade, 0-100. */
  grade: number;
}

export function grade(components: {
  swing: number;
  defense: number;
  calibration: number;
}): GradeBreakdown {
  const g =
    GRADE_WEIGHTS.swing * components.swing +
    GRADE_WEIGHTS.defense * components.defense +
    GRADE_WEIGHTS.calibration * components.calibration;
  return { ...components, grade: g };
}
