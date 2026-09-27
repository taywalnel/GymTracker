import {
  CompletedSet,
  ExerciseLog,
  ExercisePrescription,
  WorkoutSession,
} from "../models/workout.models";

// Weights entered in lb are stored as converted kg, so allow for rounding.
const WEIGHT_TOLERANCE_KG = 0.01;

export function totalReps(sets: readonly CompletedSet[]): number {
  return sets.reduce((total, set) => total + set.reps, 0);
}

/**
 * The most recent finished log of this exercise done with exactly the same
 * prescription: same rep target, every set done, and every set at the target
 * weight. Rest time is ignored.
 */
export function findComparableLog(
  sessionsNewestFirst: readonly WorkoutSession[],
  prescription: ExercisePrescription,
): ExerciseLog | null {
  for (const session of sessionsNewestFirst) {
    if (session.inProgress) continue;
    const log = session.exerciseLogs.find(
      (item) => item.exerciseId === prescription.id,
    );
    if (
      log &&
      log.targetReps === prescription.targetReps &&
      log.completedSets.length === prescription.targetSets &&
      log.completedSets.every(
        (set) =>
          Math.abs(set.weightKg - prescription.targetWeightKg) <=
          WEIGHT_TOLERANCE_KG,
      )
    ) {
      return log;
    }
  }
  return null;
}

/** "+1", "-2" or "0". */
export function formatRepDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/** Screen-reader text for a rep change, e.g. "2 reps fewer than last time". */
export function describeRepDelta(delta: number): string {
  if (delta === 0) return "Same total reps as last time";
  const count = Math.abs(delta);
  return `${count} ${count === 1 ? "rep" : "reps"} ${delta > 0 ? "more" : "fewer"} than last time`;
}
