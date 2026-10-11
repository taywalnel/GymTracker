import { Injectable } from "@angular/core";
import { Functions, httpsCallable } from "@angular/fire/functions";
import { firstValueFrom } from "rxjs";
import {
  GenerateRoutineRequest,
  GeneratedRoutine,
  ROUTINE_CATALOG_LIMIT,
  ROUTINE_RECENT_SESSIONS,
  RoutineCatalogExercise,
} from "../models/routine-generation.models";
import {
  Exercise,
  MuscleGroup,
  ResolvedExercisePrescription,
  WorkoutSession,
  targetRepsFields,
  targetWeightFields,
} from "../models/workout.models";
import { UnitPreferenceService } from "./unit-preference.service";
import { WorkoutService } from "./workout.service";

/** A generated routine ready to drop into the New Routine draft. */
export interface RoutineSuggestion {
  name: string;
  exercises: ResolvedExercisePrescription[];
  /** Exercises not yet in the catalog, added when the routine is created. */
  newExercises: Exercise[];
}

/** Thrown when there's no connection to ask for a routine. */
export class RoutineGenerationOfflineError extends Error {
  constructor() {
    super("Building a routine needs a connection.");
  }
}

/** The function's own message for errors it explains, otherwise a general one. */
export function routineGenerationErrorMessage(error: unknown): string {
  if (error instanceof RoutineGenerationOfflineError) {
    return "You're offline. Building a routine needs a connection, so try again once you're back online.";
  }
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  const explained = ["functions/resource-exhausted", "functions/unavailable"];
  return code && explained.includes(code) && message
    ? message
    : "Couldn't build a routine right now. Try again in a moment.";
}

/** AI-built routines, from the generateRoutine function. */
@Injectable({ providedIn: "root" })
export class RoutineGenerationService {
  constructor(
    private functions: Functions,
    private units: UnitPreferenceService,
    private workouts: WorkoutService,
  ) {}

  async generate(muscleGroups: MuscleGroup[]): Promise<RoutineSuggestion> {
    if (!navigator.onLine) throw new RoutineGenerationOfflineError();

    const [exercises, sessions] = await Promise.all([
      firstValueFrom(this.workouts.getAllExercises()),
      firstValueFrom(this.workouts.getSessionHistory()),
    ]);
    const request: GenerateRoutineRequest = {
      muscleGroups,
      weightStepKg: this.units.toKg(this.units.weightStep),
      catalog: buildCatalog(exercises, sessions),
    };

    const call = httpsCallable<GenerateRoutineRequest, GeneratedRoutine>(
      this.functions,
      "generateRoutine",
    );
    const routine = (await call(request)).data;
    return suggestionFromRoutine(routine, () =>
      this.workouts.generateExerciseId(),
    );
  }
}

/**
 * The routine as draft exercises. Catalog exercises keep their ids; new ones
 * get a fresh id and are listed so they can be added to the catalog later.
 */
export function suggestionFromRoutine(
  routine: GeneratedRoutine,
  newExerciseId: () => string,
): RoutineSuggestion {
  const newExercises: Exercise[] = [];
  const exercises = routine.exercises.map((generated, order) => {
    let id = generated.catalogExerciseId;
    if (!id) {
      id = newExerciseId();
      newExercises.push({
        id,
        name: generated.name,
        primaryMuscleGroup: generated.muscleGroup,
      });
    }
    return {
      id,
      name: generated.name,
      ...targetWeightFields(generated.setWeightsKg),
      ...targetRepsFields(generated.setReps),
      targetSets: generated.setReps.length,
      restSeconds: generated.restSeconds,
      order,
    };
  });
  return { name: routine.name, exercises, newExercises };
}

/**
 * The catalog with each exercise's latest sessions, newest first. Exercises
 * done recently come first so they survive the size limit.
 */
export function buildCatalog(
  exercises: readonly Exercise[],
  sessions: readonly WorkoutSession[],
): RoutineCatalogExercise[] {
  const recentById = new Map<string, RoutineCatalogExercise["recent"]>();
  for (const session of sessions) {
    if (session.inProgress) continue;
    for (const log of session.exerciseLogs) {
      if (log.completedSets.length === 0) continue;
      const recent = recentById.get(log.exerciseId) ?? [];
      if (recent.length >= ROUTINE_RECENT_SESSIONS) continue;
      recent.push({
        date: session.date,
        // The function accepts at most 20 sets per session.
        sets: log.completedSets.slice(0, 20).map(({ reps, weightKg }) => ({
          reps,
          weightKg,
        })),
      });
      recentById.set(log.exerciseId, recent);
    }
  }

  const lastDone = (exercise: Exercise) =>
    recentById.get(exercise.id)?.[0]?.date ?? "";
  return [...exercises]
    .sort((left, right) => lastDone(right).localeCompare(lastDone(left)))
    .slice(0, ROUTINE_CATALOG_LIMIT)
    .map((exercise) => ({
      id: exercise.id,
      name: exercise.name,
      ...(exercise.primaryMuscleGroup
        ? { muscleGroup: exercise.primaryMuscleGroup }
        : {}),
      recent: recentById.get(exercise.id) ?? [],
    }));
}
