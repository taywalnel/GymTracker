/**
 * Weight is always stored internally in kilograms, regardless of how it's
 * displayed. 'metric' shows kg, 'imperial' converts to lb for display only —
 * the stored/saved value never changes based on display preference.
 */
export type UnitSystem = "metric" | "imperial";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "core",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quadriceps: "Quadriceps",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

/**
 * A single completed set within a session: how many reps were actually done.
 * Weight is recorded per-set because some exercises drop weight across sets,
 * but most of the time it'll match the exercise's target weight.
 * Always stored in kilograms.
 */
export interface CompletedSet {
  setNumber: number;
  reps: number;
  weightKg: number;
  /** The planned reps for this set; absent on older logs, where the log's targetReps applies. */
  targetReps?: number;
}

/** A reusable exercise definition, stored in users/{uid}/exercises. */
export interface Exercise {
  id: string;
  name: string;
  primaryMuscleGroup?: MuscleGroup;
}

/** How exercises are grouped in the UI: a muscle group, or "other" for none. */
export type ExerciseCategory = MuscleGroup | "other";

export const EXERCISE_CATEGORIES: readonly ExerciseCategory[] = [
  ...MUSCLE_GROUPS,
  "other",
];

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  ...MUSCLE_GROUP_LABELS,
  other: "Other",
};

/**
 * Finds a catalog exercise whose name matches, ignoring case and extra
 * spaces, so the same exercise isn't added twice under slightly different
 * spellings. `excludeId` skips the exercise being renamed.
 */
export function findExerciseByName(
  exercises: readonly Exercise[],
  name: string,
  excludeId?: string,
): Exercise | undefined {
  const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();
  const target = normalize(name);
  return exercises.find(
    (exercise) =>
      exercise.id !== excludeId && normalize(exercise.name) === target,
  );
}

/** Exercises with no muscle group, or one no longer recognised, are "other". */
export function exerciseCategory(exercise: Exercise): ExerciseCategory {
  const group = exercise.primaryMuscleGroup;
  return group && MUSCLE_GROUPS.includes(group) ? group : "other";
}

/**
 * The routine-specific prescription for an exercise. This is stored inline in
 * a routine and references an Exercise by id.
 */
export interface ExercisePrescription {
  id: string;
  /** The first set's target weight; every set's when setWeightsKg is absent. */
  targetWeightKg: number;
  /** A target weight for each set, only stored when the sets' weights differ. */
  setWeightsKg?: number[];
  /** The first set's target reps; every set's when setReps is absent. */
  targetReps: number;
  /** Target reps for each set, only stored when the sets' reps differ. */
  setReps?: number[];
  targetSets: number;
  /** Rest between sets in seconds; absent on legacy routines and defaults to 60. */
  restSeconds?: number;
  /** Order within the routine, for display */
  order: number;
}

/** The target weight for one set (0-indexed) of a prescription. */
export function targetWeightKgForSet(
  prescription: ExercisePrescription,
  setIndex: number,
): number {
  return prescription.setWeightsKg?.[setIndex] ?? prescription.targetWeightKg;
}

/** The target weight for every set of a prescription. */
export function targetWeightsKg(prescription: ExercisePrescription): number[] {
  return Array.from({ length: prescription.targetSets }, (_, index) =>
    targetWeightKgForSet(prescription, index),
  );
}

/**
 * The prescription weight fields for these per-set weights. setWeightsKg is
 * left out when every set is the same, so a plain exercise stays plain.
 */
export function targetWeightFields(
  weightsKg: readonly number[],
): Pick<ExercisePrescription, "targetWeightKg" | "setWeightsKg"> {
  const [targetWeightKg = 0] = weightsKg;
  return weightsKg.every((weightKg) => weightKg === targetWeightKg)
    ? { targetWeightKg }
    : { targetWeightKg, setWeightsKg: [...weightsKg] };
}

/** The target reps for one set (0-indexed) of a prescription. */
export function targetRepsForSet(
  prescription: ExercisePrescription,
  setIndex: number,
): number {
  return prescription.setReps?.[setIndex] ?? prescription.targetReps;
}

/** The target reps for every set of a prescription. */
export function targetRepsPerSet(prescription: ExercisePrescription): number[] {
  return Array.from({ length: prescription.targetSets }, (_, index) =>
    targetRepsForSet(prescription, index),
  );
}

/**
 * The prescription rep fields for these per-set reps. setReps is left out
 * when every set is the same, so a plain exercise stays plain.
 */
export function targetRepsFields(
  reps: readonly number[],
): Pick<ExercisePrescription, "targetReps" | "setReps"> {
  const [targetReps = 0] = reps;
  return reps.every((count) => count === targetReps)
    ? { targetReps }
    : { targetReps, setReps: [...reps] };
}

/** "10" when every set is the same, otherwise each set's, e.g. "12/10/8". */
export function formatTargetReps(reps: readonly number[]): string {
  return reps.every((count) => count === reps[0])
    ? String(reps[0] ?? "")
    : reps.join("/");
}

/** An exercise prescription with its catalog name resolved for the UI. */
export interface ResolvedExercisePrescription extends ExercisePrescription {
  name: string;
}

/**
 * A named routine (e.g. "Chest / Triceps") made up of an ordered list of
 * exercise prescriptions. Routines are the building blocks of the rotation.
 */
export interface Routine {
  id: string;
  name: string;
  /** Position in the rotation loop, 0-indexed */
  rotationOrder: number;
  /**
   * False when the routine is kept in the library instead of the rotation.
   * Absent on older routines, which are all in the rotation.
   */
  active?: boolean;
  exercises: ResolvedExercisePrescription[];
}

/** Whether the routine comes up in the rotation; routines without the flag do. */
export function isRoutineActive(routine: Pick<Routine, "active">): boolean {
  return routine.active !== false;
}

/** The Firestore representation of a routine, without catalog exercise names. */
export interface StoredRoutine {
  id: string;
  name: string;
  rotationOrder: number;
  /** False when the routine is in the library; see Routine.active. */
  active?: boolean;
  exercises: ExercisePrescription[];
}

/**
 * One logged set of actual performance for one exercise, tied to a session.
 */
export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  /**
   * The planned rep target at the time of the session (the first set's when
   * sets have their own), used to colour-code dots in history.
   */
  targetReps?: number;
  /** The planned number of sets; absent on older logs. */
  targetSets?: number;
  completedSets: CompletedSet[];
}

/**
 * The target reps a logged set was done against: its own, or on older logs
 * the log's single target. Undefined on logs from before targets were saved.
 */
export function setTargetReps(
  log: ExerciseLog,
  set: CompletedSet,
): number | undefined {
  return set.targetReps ?? log.targetReps;
}

/**
 * The log to save for an exercise from its working sets: only sets with reps
 * are kept, each stamped with its planned reps from the prescription.
 */
export function exerciseLogFromWorkingSets(
  prescription: ResolvedExercisePrescription,
  workingSets: readonly CompletedSet[],
): ExerciseLog {
  return {
    exerciseId: prescription.id,
    exerciseName: prescription.name,
    targetReps: prescription.targetReps,
    targetSets: prescription.targetSets,
    completedSets: workingSets
      .map((set, index) => ({
        ...set,
        targetReps: targetRepsForSet(prescription, index),
      }))
      .filter((set) => set.reps > 0),
  };
}

/**
 * A full workout session: one instance of doing a routine on a given date.
 * This is what gets persisted to history.
 */
export interface WorkoutSession {
  id: string;
  routineId: string;
  routineName: string;
  date: string; // ISO date string
  exerciseLogs: ExerciseLog[];
  /** True while the session is in progress and not yet marked complete */
  inProgress: boolean;
  /** True when the session belongs to the active workout rotation. */
  active?: boolean;
  /** How long the workout took; absent on older sessions. */
  durationSeconds?: number;
  /** ISO timestamp of when the workout was finished, to order sessions on the same date. */
  completedAt?: string;
}

/** Newest first by date, then by finish time for sessions on the same date. */
export function compareSessionsNewestFirst(
  left: WorkoutSession,
  right: WorkoutSession,
): number {
  return (
    right.date.localeCompare(left.date) ||
    (right.completedAt ?? "").localeCompare(left.completedAt ?? "")
  );
}

/**
 * The rotation routine that comes after the last one done, skipping library
 * routines. One-off workouts from the library, and routines since deleted or
 * moved to the library, don't move the rotation along. Null when no routine
 * is in the rotation.
 */
export function nextRoutineInRotation(
  routines: readonly Routine[],
  sessions: readonly WorkoutSession[],
): Routine | null {
  const rotation = routines
    .filter(isRoutineActive)
    .sort((left, right) => left.rotationOrder - right.rotationOrder);
  if (rotation.length === 0) return null;

  const lastRoutine = [...sessions]
    .filter((session) => !session.inProgress)
    .sort(compareSessionsNewestFirst)
    .map((session) => rotation.find((r) => r.id === session.routineId))
    .find((routine) => routine !== undefined);
  if (!lastRoutine) return rotation[0];

  const index = rotation.indexOf(lastRoutine);
  return rotation[(index + 1) % rotation.length];
}

/**
 * The result of asking "what should I do today" - bundles the routine
 * definition with the most recent prior performance for each exercise,
 * so the UI can show "last time you did 10/8/6" next to each target.
 */
export interface TodayWorkout {
  routine: Routine;
  previousSession: WorkoutSession | null;
  /** Quick lookup: exerciseId -> the last completed log for that exercise (may be from an older session if it wasn't done last time) */
  lastPerformance: Map<string, ExerciseLog>;
}
