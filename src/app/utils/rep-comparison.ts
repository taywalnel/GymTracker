import {
  CompletedSet,
  ExerciseLog,
  ExercisePrescription,
  WorkoutSession,
  setTargetReps,
  targetRepsForSet,
  targetWeightKgForSet,
} from "../models/workout.models";

// Weights entered in lb are stored as converted kg, so allow for rounding.
export const WEIGHT_TOLERANCE_KG = 0.01;

export function totalReps(sets: readonly CompletedSet[]): number {
  return sets.reduce((total, set) => total + set.reps, 0);
}

/**
 * Average planned reps across a log's sets, or undefined for older logs
 * saved without a rep target.
 */
export function averageTargetReps(log: ExerciseLog): number | undefined {
  if (log.targetReps === undefined) return undefined;
  if (!log.completedSets.length) return log.targetReps;
  return (
    log.completedSets.reduce(
      (total, set) => total + (setTargetReps(log, set) ?? 0),
      0,
    ) / log.completedSets.length
  );
}

/**
 * The most recent finished log of this exercise done with exactly the same
 * prescription: every set done, each at its target reps and target weight.
 * Rest time is ignored.
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
      log.completedSets.length === prescription.targetSets &&
      log.completedSets.every(
        (set, index) =>
          setTargetReps(log, set) === targetRepsForSet(prescription, index) &&
          Math.abs(set.weightKg - targetWeightKgForSet(prescription, index)) <=
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
