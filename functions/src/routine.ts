/**
 * The contract between the app and the generateRoutine function, and the
 * pure logic around it: checking the request, summarising the catalog for
 * the model, and making the model's routine safe to use.
 *
 * Weights are always kilograms, matching how the app stores them.
 */

/** Keep in step with MUSCLE_GROUPS in src/app/models/workout.models.ts. */
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

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  core: "Core",
  glutes: "Glutes",
  quadriceps: "Quads",
  hamstrings: "Hamstrings",
  calves: "Calves",
};

export interface RoutineSet {
  reps: number;
  weightKg: number;
}

export interface RoutineCatalogExercise {
  id: string;
  name: string;
  /** From the exercise catalog; absent when not set. */
  muscleGroup?: string | null;
  /** Latest sessions with this exercise, newest first. */
  recent: { date: string; sets: RoutineSet[] }[];
}

export interface GenerateRoutineRequest {
  muscleGroups: MuscleGroup[];
  /** The weight step on the person's equipment, e.g. 2.5 kg or 5 lb in kg. */
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

export const MAX_MUSCLE_GROUPS = 4;
export const MAX_CATALOG = 150;
export const MAX_RECENT = 3;
const MAX_EXERCISES = 8;
const MAX_SETS = 6;
const MAX_REPS = 30;
const MAX_WEIGHT_KG = 500;
const MIN_REST = 30;
const MAX_REST = 300;
const REST_STEP = 15;
const DEFAULT_REST = 90;
const MAX_NAME_LENGTH = 60;

// ---- request checks -------------------------------------------------------

const isNumber = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

const isText = (value: unknown, maxLength: number) =>
  typeof value === "string" && !!value.trim() && value.length <= maxLength;

export const isMuscleGroup = (value: unknown): value is MuscleGroup =>
  MUSCLE_GROUPS.includes(value as MuscleGroup);

function isCatalogExercise(value: unknown): value is RoutineCatalogExercise {
  const exercise = value as RoutineCatalogExercise;
  return (
    typeof exercise === "object" &&
    exercise !== null &&
    isText(exercise.id, 100) &&
    isText(exercise.name, 100) &&
    (exercise.muscleGroup == null ||
      (typeof exercise.muscleGroup === "string" &&
        exercise.muscleGroup.length <= 40)) &&
    Array.isArray(exercise.recent) &&
    exercise.recent.length <= MAX_RECENT &&
    exercise.recent.every(
      (session) =>
        typeof session === "object" &&
        session !== null &&
        isText(session.date, 40) &&
        Array.isArray(session.sets) &&
        session.sets.length <= 20 &&
        session.sets.every(
          (set) =>
            typeof set === "object" &&
            set !== null &&
            isNumber(set.reps, 0, 1000) &&
            isNumber(set.weightKg, 0, 2000),
        ),
    )
  );
}

/** Returns an error message when the request isn't usable, otherwise null. */
export function requestError(data: unknown): string | null {
  const request = data as GenerateRoutineRequest;
  if (typeof request !== "object" || request === null) return "Missing request.";
  if (
    !Array.isArray(request.muscleGroups) ||
    request.muscleGroups.length < 1 ||
    request.muscleGroups.length > MAX_MUSCLE_GROUPS ||
    !request.muscleGroups.every(isMuscleGroup) ||
    new Set(request.muscleGroups).size !== request.muscleGroups.length
  ) {
    return `Choose 1 to ${MAX_MUSCLE_GROUPS} muscle groups.`;
  }
  if (!isNumber(request.weightStepKg, 0.1, 10)) return "Invalid weight step.";
  if (
    !Array.isArray(request.catalog) ||
    request.catalog.length > MAX_CATALOG ||
    !request.catalog.every(isCatalogExercise)
  ) {
    return "Invalid exercise catalog.";
  }
  return null;
}

// ---- catalog summary ------------------------------------------------------

/** "8×40, 8×40, 6×40" for a session's sets. */
const describeSets = (sets: readonly RoutineSet[]) =>
  sets.map((set) => `${set.reps}×${set.weightKg}`).join(", ");

/** The catalog as the model sees it: compact, with sets written out. */
export function summariseCatalog(request: GenerateRoutineRequest) {
  return request.catalog.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup ?? null,
    recentSessions: exercise.recent
      .filter((session) => session.sets.length > 0)
      .map((session) => `${session.date}: ${describeSets(session.sets)}`),
  }));
}

// ---- making the routine safe ----------------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const round = (value: number, decimals = 3) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const normaliseName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

/** "Chest & Triceps", "Chest, Back & Biceps". */
export function defaultRoutineName(groups: readonly MuscleGroup[]): string {
  const labels = groups.map((group) => MUSCLE_GROUP_LABELS[group]);
  return labels.length > 1
    ? `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`
    : (labels[0] ?? "New routine");
}

/**
 * Rounds a weight to the equipment's step, except a weight the person has
 * actually logged for this exercise, which may sit off a step (e.g. 45.4 kg
 * for 100 lb).
 */
function stepWeight(
  value: unknown,
  step: number,
  logged: readonly number[],
): number {
  const weight = clamp(Number(value) || 0, 0, MAX_WEIGHT_KG);
  if (logged.some((loggedWeight) => Math.abs(loggedWeight - weight) < 0.01)) {
    return weight;
  }
  return round(Math.round(weight / step) * step);
}

/**
 * Matches each exercise to the catalog (by id, then by name), drops repeats
 * and nameless ones, and keeps targets within safe bounds: 1–8 exercises,
 * 1–6 sets, 1–30 reps, rest 30–300s, weights on the equipment's step.
 * Throws when nothing usable is left.
 */
export function normaliseRoutine(
  raw: unknown,
  request: GenerateRoutineRequest,
): GeneratedRoutine {
  const routine = raw as Partial<GeneratedRoutine>;
  const catalogById = new Map(request.catalog.map((item) => [item.id, item]));
  const catalogByName = new Map(
    request.catalog.map((item) => [normaliseName(item.name), item]),
  );
  const fallbackGroup = request.muscleGroups[0];
  const seen = new Set<string>();
  const exercises: GeneratedExercise[] = [];

  for (const proposed of Array.isArray(routine?.exercises)
    ? routine.exercises
    : []) {
    if (exercises.length >= MAX_EXERCISES) break;
    if (typeof proposed !== "object" || proposed === null) continue;

    const name =
      typeof proposed.name === "string"
        ? proposed.name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH)
        : "";
    const catalogItem =
      catalogById.get(String(proposed.catalogExerciseId ?? "")) ??
      catalogByName.get(normaliseName(name));
    if (!catalogItem && !name) continue;

    const key = catalogItem?.id ?? normaliseName(name);
    if (seen.has(key)) continue;
    seen.add(key);

    const reps = Array.isArray(proposed.setReps) ? proposed.setReps : [];
    const setCount = clamp(reps.length, 1, MAX_SETS);
    const setReps = Array.from({ length: setCount }, (_, index) =>
      clamp(Math.round(Number(reps[index]) || 0), 1, MAX_REPS),
    );
    const weights = Array.isArray(proposed.setWeightsKg)
      ? proposed.setWeightsKg
      : [];
    const logged = (catalogItem?.recent ?? []).flatMap((session) =>
      session.sets.map((set) => set.weightKg),
    );
    const setWeightsKg = Array.from({ length: setCount }, (_, index) =>
      stepWeight(
        weights[index] ?? weights[weights.length - 1],
        request.weightStepKg,
        logged,
      ),
    );
    const restSeconds = clamp(
      Math.round((Number(proposed.restSeconds) || DEFAULT_REST) / REST_STEP) *
        REST_STEP,
      MIN_REST,
      MAX_REST,
    );

    const catalogGroup = catalogItem?.muscleGroup;
    exercises.push({
      catalogExerciseId: catalogItem?.id ?? null,
      name: catalogItem?.name ?? name,
      muscleGroup: isMuscleGroup(catalogGroup)
        ? catalogGroup
        : isMuscleGroup(proposed.muscleGroup)
          ? proposed.muscleGroup
          : fallbackGroup,
      setWeightsKg,
      setReps,
      restSeconds,
    });
  }

  if (exercises.length === 0) {
    throw new Error("The routine had no usable exercises.");
  }

  const name =
    typeof routine?.name === "string" && routine.name.trim()
      ? routine.name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH)
      : defaultRoutineName(request.muscleGroups);
  return { name, exercises };
}
