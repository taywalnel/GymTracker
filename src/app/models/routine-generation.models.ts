import { MuscleGroup } from "./workout.models";

/**
 * The contract with the generateRoutine Cloud Function; keep in step with
 * functions/src/routine.ts. Weights are always kilograms.
 */
export interface RoutineCatalogExercise {
  id: string;
  name: string;
  muscleGroup?: MuscleGroup;
  /** Newest first. */
  recent: { date: string; sets: { reps: number; weightKg: number }[] }[];
}

export interface GenerateRoutineRequest {
  muscleGroups: MuscleGroup[];
  weightStepKg: number;
  catalog: RoutineCatalogExercise[];
}

export interface GeneratedExercise {
  /** The catalog exercise's id, or null for an exercise to add. */
  catalogExerciseId: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  setWeightsKg: number[];
  setReps: number[];
  restSeconds: number;
}

export interface GeneratedRoutine {
  name: string;
  exercises: GeneratedExercise[];
}

/** Muscle groups per request; the function accepts at most 4. */
export const ROUTINE_MAX_MUSCLE_GROUPS = 4;
/** Catalog exercises sent; the function accepts at most 150. */
export const ROUTINE_CATALOG_LIMIT = 150;
/** Sessions sent per exercise; the function accepts at most 3. */
export const ROUTINE_RECENT_SESSIONS = 3;
