import {
  CompletedSet,
  ExerciseLog,
  WorkoutSession,
} from "../models/workout.models";
import { WEIGHT_TOLERANCE_KG } from "./rep-comparison";

export type PersonalRecordKind =
  "heaviestWeight" | "estimatedOneRepMax" | "repsAtWeight" | "sessionVolume";

export interface PersonalRecord {
  kind: PersonalRecordKind;
  /** The new best: kg, or a rep count for "repsAtWeight". */
  value: number;
  /** The best before this log, in the same unit as `value`. */
  previous: number;
  /** For "repsAtWeight": the weight the reps were done at. */
  weightKg?: number;
}

export interface ExerciseRecords {
  exerciseId: string;
  exerciseName: string;
  records: PersonalRecord[];
}

/** Epley estimate of the most weight that could be lifted for one rep. */
export function estimatedOneRepMax(set: CompletedSet): number {
  return set.weightKg * (1 + set.reps / 30);
}

/** Total weight moved: weight × reps, summed over every set. */
export function sessionVolume(log: ExerciseLog): number {
  return log.completedSets.reduce(
    (total, set) => total + set.weightKg * set.reps,
    0,
  );
}

function best<T>(items: readonly T[], value: (item: T) => number): number {
  return items.reduce((max, item) => Math.max(max, value(item)), 0);
}

/**
 * The records `log` sets against every earlier log of the same exercise.
 * Only strict improvements count, and a first-ever log sets none since there
 * is nothing to beat.
 */
export function findPersonalRecords(
  log: ExerciseLog,
  earlierLogs: readonly ExerciseLog[],
): PersonalRecord[] {
  const sets = log.completedSets;
  const earlierSets = earlierLogs.flatMap((item) => item.completedSets);
  if (sets.length === 0 || earlierSets.length === 0) return [];

  const records: PersonalRecord[] = [];
  const beats = (value: number, previous: number) =>
    value > previous + WEIGHT_TOLERANCE_KG;

  const heaviest = best(sets, (set) => set.weightKg);
  const previousHeaviest = best(earlierSets, (set) => set.weightKg);
  if (beats(heaviest, previousHeaviest)) {
    records.push({
      kind: "heaviestWeight",
      value: heaviest,
      previous: previousHeaviest,
    });
  }

  const oneRepMax = best(sets, estimatedOneRepMax);
  const previousOneRepMax = best(earlierSets, estimatedOneRepMax);
  if (beats(oneRepMax, previousOneRepMax)) {
    records.push({
      kind: "estimatedOneRepMax",
      value: oneRepMax,
      previous: previousOneRepMax,
    });
  }

  // Most reps at a weight already lifted before. A weight never lifted before
  // is a heaviest-weight record instead. Only the heaviest such weight counts.
  const byWeightDescending = [...sets].sort(
    (left, right) => right.weightKg - left.weightKg,
  );
  for (const set of byWeightDescending) {
    const atOrAbove = earlierSets.filter(
      (item) => item.weightKg >= set.weightKg - WEIGHT_TOLERANCE_KG,
    );
    if (atOrAbove.length === 0) continue;
    const reps = best(
      sets.filter(
        (item) => Math.abs(item.weightKg - set.weightKg) <= WEIGHT_TOLERANCE_KG,
      ),
      (item) => item.reps,
    );
    const previousReps = best(atOrAbove, (item) => item.reps);
    if (reps > previousReps) {
      records.push({
        kind: "repsAtWeight",
        value: reps,
        previous: previousReps,
        weightKg: set.weightKg,
      });
      break;
    }
  }

  const volume = sessionVolume(log);
  const previousVolume = best(earlierLogs, sessionVolume);
  if (beats(volume, previousVolume)) {
    records.push({
      kind: "sessionVolume",
      value: volume,
      previous: previousVolume,
    });
  }

  return records;
}

/**
 * Records set in `session`, compared with the sessions after it in
 * `sessionsNewestFirst` (the same "earlier" as the reps-vs-last comparison).
 * Exercises with no records are left out.
 */
export function findSessionRecords(
  session: WorkoutSession,
  sessionsNewestFirst: readonly WorkoutSession[],
): ExerciseRecords[] {
  const index = sessionsNewestFirst.findIndex((item) => item.id === session.id);
  const earlier = (
    index === -1 ? [] : sessionsNewestFirst.slice(index + 1)
  ).filter((item) => !item.inProgress);

  return session.exerciseLogs.flatMap((log) => {
    const earlierLogs = earlier.flatMap((item) =>
      item.exerciseLogs.filter(
        (earlierLog) => earlierLog.exerciseId === log.exerciseId,
      ),
    );
    const records = findPersonalRecords(log, earlierLogs);
    return records.length === 0
      ? []
      : [
          {
            exerciseId: log.exerciseId,
            exerciseName: log.exerciseName,
            records,
          },
        ];
  });
}
