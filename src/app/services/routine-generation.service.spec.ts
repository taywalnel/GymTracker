import { GeneratedRoutine } from "../models/routine-generation.models";
import { Exercise, WorkoutSession } from "../models/workout.models";
import {
  RoutineGenerationOfflineError,
  buildCatalog,
  routineGenerationErrorMessage,
  suggestionFromRoutine,
} from "./routine-generation.service";

describe("routine generation", () => {
  const session = (
    date: string,
    exerciseIds: string[],
    inProgress = false,
  ): WorkoutSession => ({
    id: date,
    routineId: "r",
    routineName: "R",
    date,
    inProgress,
    exerciseLogs: exerciseIds.map((exerciseId) => ({
      exerciseId,
      exerciseName: exerciseId,
      targetReps: 8,
      targetSets: 2,
      completedSets: [
        { setNumber: 1, reps: 8, weightKg: 40, targetReps: 8 },
        { setNumber: 2, reps: 7, weightKg: 40, targetReps: 8 },
      ],
    })),
  });

  describe("buildCatalog", () => {
    const exercises: Exercise[] = [
      { id: "fly", name: "Fly", primaryMuscleGroup: "chest" },
      { id: "bench", name: "Bench", primaryMuscleGroup: "chest" },
      { id: "curl", name: "Curl" },
    ];
    // Newest first, as the service returns them.
    const sessions = [
      session("2026-10-04", ["curl"], true),
      session("2026-10-03", ["bench"]),
      session("2026-10-02", ["bench"]),
      session("2026-10-01", ["bench", "curl"]),
      session("2026-09-30", ["bench"]),
    ];

    it("lists recently done exercises first, then the rest", () => {
      expect(buildCatalog(exercises, sessions).map((e) => e.id)).toEqual([
        "bench",
        "curl",
        "fly",
      ]);
    });

    it("sends each exercise's latest 3 finished sessions, newest first", () => {
      const [bench, curl, fly] = buildCatalog(exercises, sessions);
      expect(bench.recent.map((s) => s.date)).toEqual([
        "2026-10-03",
        "2026-10-02",
        "2026-10-01",
      ]);
      expect(bench.recent[0].sets).toEqual([
        { reps: 8, weightKg: 40 },
        { reps: 7, weightKg: 40 },
      ]);
      expect(curl.recent.map((s) => s.date)).toEqual(["2026-10-01"]);
      expect(fly.recent).toEqual([]);
    });

    it("includes the muscle group only when set", () => {
      const [bench, curl] = buildCatalog(exercises, sessions);
      expect(bench.muscleGroup).toBe("chest");
      expect("muscleGroup" in curl).toBeFalse();
    });

    it("caps the catalog at 150 exercises", () => {
      const many = Array.from({ length: 200 }, (_, index) => ({
        id: `e${index}`,
        name: `Exercise ${index}`,
      }));
      expect(buildCatalog(many, []).length).toBe(150);
    });
  });

  describe("suggestionFromRoutine", () => {
    const routine: GeneratedRoutine = {
      name: "Chest & Triceps",
      exercises: [
        {
          catalogExerciseId: "bench",
          name: "Bench",
          muscleGroup: "chest",
          setWeightsKg: [40, 40, 40],
          setReps: [8, 8, 8],
          restSeconds: 150,
        },
        {
          catalogExerciseId: null,
          name: "Cable Fly",
          muscleGroup: "chest",
          setWeightsKg: [10, 12.5],
          setReps: [12, 10],
          restSeconds: 90,
        },
      ],
    };

    it("keeps catalog ids and gives new exercises a fresh one", () => {
      const suggestion = suggestionFromRoutine(routine, () => "new-id");

      expect(suggestion.name).toBe("Chest & Triceps");
      expect(suggestion.exercises).toEqual([
        {
          id: "bench",
          name: "Bench",
          targetWeightKg: 40,
          targetReps: 8,
          targetSets: 3,
          restSeconds: 150,
          order: 0,
        },
        {
          id: "new-id",
          name: "Cable Fly",
          targetWeightKg: 10,
          setWeightsKg: [10, 12.5],
          targetReps: 12,
          setReps: [12, 10],
          targetSets: 2,
          restSeconds: 90,
          order: 1,
        },
      ]);
      expect(suggestion.newExercises).toEqual([
        { id: "new-id", name: "Cable Fly", primaryMuscleGroup: "chest" },
      ]);
    });
  });

  describe("routineGenerationErrorMessage", () => {
    it("explains being offline", () => {
      expect(
        routineGenerationErrorMessage(new RoutineGenerationOfflineError()),
      ).toContain("offline");
    });

    it("passes on the function's message for limits", () => {
      expect(
        routineGenerationErrorMessage({
          code: "functions/resource-exhausted",
          message: "You've built today's limit of AI routines.",
        }),
      ).toBe("You've built today's limit of AI routines.");
    });

    it("hides other errors behind a general message", () => {
      expect(
        routineGenerationErrorMessage({
          code: "functions/internal",
          message: "Stack trace",
        }),
      ).toBe("Couldn't build a routine right now. Try again in a moment.");
    });
  });
});
