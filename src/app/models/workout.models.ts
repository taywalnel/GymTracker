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
  targetWeightKg: number;
  targetReps: number;
  targetSets: number;
  /** Rest between sets in seconds; absent on legacy routines and defaults to 60. */
  restSeconds?: number;
  /** Order within the routine, for display */
  order: number;
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
  /** True when the routine belongs to the active workout rotation. */
  active?: boolean;
  exercises: ResolvedExercisePrescription[];
}

/** The Firestore representation of a routine, without catalog exercise names. */
export interface StoredRoutine {
  id: string;
  name: string;
  rotationOrder: number;
  /** True when the routine belongs to the active workout rotation. */
  active?: boolean;
  exercises: ExercisePrescription[];
}

/**
 * One logged set of actual performance for one exercise, tied to a session.
 */
export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  /** The planned rep target at the time of the session, used to colour-code dots in history. */
  targetReps?: number;
  completedSets: CompletedSet[];
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
