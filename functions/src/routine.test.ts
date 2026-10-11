import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GenerateRoutineRequest,
  defaultRoutineName,
  normaliseRoutine,
  requestError,
} from "./routine";
import { routineMessageParams } from "./routine-prompt";

const request: GenerateRoutineRequest = {
  muscleGroups: ["chest", "triceps"],
  weightStepKg: 2.5,
  catalog: [
    {
      id: "bench",
      name: "Bench Press",
      muscleGroup: "chest",
      recent: [
        {
          date: "2026-10-01",
          sets: [
            { reps: 8, weightKg: 45.4 },
            { reps: 7, weightKg: 45.4 },
          ],
        },
      ],
    },
    { id: "pushdown", name: "Triceps Pushdown", muscleGroup: "triceps", recent: [] },
  ],
};

const exercise = (overrides: object) => ({
  catalogExerciseId: "",
  name: "Cable Fly",
  muscleGroup: "chest",
  setWeightsKg: [10, 10, 10],
  setReps: [12, 12, 12],
  restSeconds: 90,
  ...overrides,
});

describe("requestError", () => {
  it("accepts a valid request", () => {
    assert.equal(requestError(request), null);
  });

  it("rejects unknown, repeated or too many muscle groups", () => {
    for (const muscleGroups of [
      [],
      ["neck"],
      ["chest", "chest"],
      ["chest", "back", "biceps", "triceps", "calves"],
    ]) {
      assert.notEqual(requestError({ ...request, muscleGroups }), null);
    }
  });

  it("rejects a malformed catalog", () => {
    assert.notEqual(
      requestError({ ...request, catalog: [{ id: "x", name: "" }] }),
      null,
    );
  });
});

describe("normaliseRoutine", () => {
  it("matches catalog exercises by id, then by name", () => {
    const routine = normaliseRoutine(
      {
        name: "Push",
        exercises: [
          exercise({ catalogExerciseId: "bench", name: "Flat bench" }),
          exercise({ name: "  triceps   pushdown " }),
          exercise({ name: "Cable Fly" }),
        ],
      },
      request,
    );
    assert.deepEqual(
      routine.exercises.map((item) => [item.catalogExerciseId, item.name]),
      [
        ["bench", "Bench Press"],
        ["pushdown", "Triceps Pushdown"],
        [null, "Cable Fly"],
      ],
    );
  });

  it("drops repeats and nameless exercises", () => {
    const routine = normaliseRoutine(
      {
        name: "Push",
        exercises: [
          exercise({ catalogExerciseId: "bench" }),
          exercise({ name: "bench press" }),
          exercise({ name: "  " }),
          exercise({ name: "Cable Fly" }),
          exercise({ name: "cable fly" }),
        ],
      },
      request,
    );
    assert.deepEqual(
      routine.exercises.map((item) => item.name),
      ["Bench Press", "Cable Fly"],
    );
  });

  it("keeps targets within bounds and on the weight step", () => {
    const [item] = normaliseRoutine(
      {
        name: "Push",
        exercises: [
          exercise({
            setWeightsKg: [11.2, -5],
            setReps: [0, 12.6, 99, 8, 8, 8, 8, 8],
            restSeconds: 1000,
          }),
        ],
      },
      request,
    ).exercises;
    assert.deepEqual(item.setReps, [1, 13, 30, 8, 8, 8]);
    assert.deepEqual(item.setWeightsKg, [10, 0, 0, 0, 0, 0]);
    assert.equal(item.restSeconds, 300);
  });

  it("keeps a logged weight that isn't on the step", () => {
    const [item] = normaliseRoutine(
      {
        name: "Push",
        exercises: [
          exercise({ catalogExerciseId: "bench", setWeightsKg: [45.4, 45.4] }),
        ],
      },
      request,
    ).exercises;
    assert.deepEqual(item.setWeightsKg, [45.4, 45.4, 45.4]);
  });

  it("uses the catalog's muscle group, then the model's, then the first chosen", () => {
    const routine = normaliseRoutine(
      {
        name: "Push",
        exercises: [
          exercise({ catalogExerciseId: "bench", muscleGroup: "back" }),
          exercise({ name: "Dips", muscleGroup: "triceps" }),
          exercise({ name: "Mystery", muscleGroup: "neck" }),
        ],
      },
      request,
    );
    assert.deepEqual(
      routine.exercises.map((item) => item.muscleGroup),
      ["chest", "triceps", "chest"],
    );
  });

  it("names the routine after its groups when the model didn't", () => {
    const routine = normaliseRoutine(
      { name: " ", exercises: [exercise({})] },
      request,
    );
    assert.equal(routine.name, "Chest & Triceps");
    assert.equal(
      defaultRoutineName(["chest", "back", "biceps"]),
      "Chest, Back & Biceps",
    );
  });

  it("throws when no exercise is usable", () => {
    assert.throws(() => normaliseRoutine({ name: "Push", exercises: [] }, request));
    assert.throws(() => normaliseRoutine(null, request));
  });
});

describe("routineMessageParams", () => {
  it("includes the coaching guide's rep-range table", () => {
    const params = routineMessageParams(request);
    assert.match(String(params.system), /Heavy barbell compound/);
  });
});
