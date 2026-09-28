import {
  CompletedSet,
  ExercisePrescription,
  WorkoutSession,
} from "../models/workout.models";
import {
  averageTargetReps,
  findComparableLog,
  totalReps,
} from "./rep-comparison";

describe("rep comparison", () => {
  const benchPress: ExercisePrescription = {
    id: "bench",
    targetWeightKg: 30,
    targetReps: 10,
    targetSets: 3,
    order: 0,
  };

  function sets(reps: number[], weightKg = 30): CompletedSet[] {
    return reps.map((count, index) => ({
      setNumber: index + 1,
      reps: count,
      weightKg,
    }));
  }

  function session(
    id: string,
    completedSets: CompletedSet[],
    overrides: { targetReps?: number; inProgress?: boolean } = {},
  ): WorkoutSession {
    return {
      id,
      routineId: "routine",
      routineName: "Routine",
      date: "2026-09-01",
      inProgress: overrides.inProgress ?? false,
      exerciseLogs: [
        {
          exerciseId: "bench",
          exerciseName: "Bench Press",
          targetReps: "targetReps" in overrides ? overrides.targetReps : 10,
          completedSets,
        },
      ],
    };
  }

  it("totals reps across sets", () => {
    expect(totalReps(sets([10, 9, 7]))).toBe(26);
  });

  it("compares 10/9/7 against 10/8/7 as +1", () => {
    const previous = findComparableLog(
      [session("last", sets([10, 8, 7]))],
      benchPress,
    );
    expect(
      totalReps(sets([10, 9, 7])) - totalReps(previous!.completedSets),
    ).toBe(1);
  });

  it("uses the newest matching log", () => {
    const log = findComparableLog(
      [session("newer", sets([10, 10, 8])), session("older", sets([8, 8, 8]))],
      benchPress,
    );
    expect(totalReps(log!.completedSets)).toBe(28);
  });

  it("skips logs at a different weight", () => {
    const log = findComparableLog(
      [
        session("heavier", sets([10, 8, 7], 32.5)),
        session("same", sets([9, 9, 9])),
      ],
      benchPress,
    );
    expect(totalReps(log!.completedSets)).toBe(27);
  });

  it("tolerates rounding from pound conversions", () => {
    const log = findComparableLog(
      [session("rounded", sets([10, 8, 7], 30.004))],
      benchPress,
    );
    expect(log).not.toBeNull();
  });

  it("skips logs with a different rep target or no rep target", () => {
    expect(
      findComparableLog(
        [
          session("different", sets([8, 8, 8]), { targetReps: 8 }),
          session("legacy", sets([10, 8, 7]), { targetReps: undefined }),
        ],
        benchPress,
      ),
    ).toBeNull();
  });

  it("skips logs with fewer sets than planned", () => {
    expect(
      findComparableLog([session("short", sets([10, 8]))], benchPress),
    ).toBeNull();
  });

  it("compares each set against its own target weight", () => {
    const pyramid: ExercisePrescription = {
      ...benchPress,
      setWeightsKg: [30, 35, 40],
    };
    const atPlannedWeights = [30, 35, 40].map((weightKg, index) => ({
      setNumber: index + 1,
      reps: 10,
      weightKg,
    }));

    expect(
      findComparableLog([session("pyramid", atPlannedWeights)], pyramid),
    ).not.toBeNull();
    expect(
      findComparableLog([session("flat", sets([10, 10, 10]))], pyramid),
    ).toBeNull();
  });

  it("compares each set against its own target reps", () => {
    const pyramid: ExercisePrescription = {
      ...benchPress,
      targetReps: 12,
      setReps: [12, 10, 8],
    };
    const atPlannedReps = [12, 10, 8].map((targetReps, index) => ({
      setNumber: index + 1,
      reps: targetReps,
      weightKg: 30,
      targetReps,
    }));

    expect(
      findComparableLog(
        [session("pyramid", atPlannedReps, { targetReps: 12 })],
        pyramid,
      ),
    ).not.toBeNull();
    expect(
      findComparableLog([session("flat", sets([10, 10, 10]))], pyramid),
    ).toBeNull();
  });

  it("still matches logs saved before per-set targets against a plain routine", () => {
    // sets() builds sets without targetReps, like older saved logs.
    expect(
      findComparableLog([session("legacy", sets([10, 9, 8]))], benchPress),
    ).not.toBeNull();
  });

  it("averages per-set targets, falling back to the log's target", () => {
    const log = session("mixed", [
      { setNumber: 1, reps: 12, weightKg: 30, targetReps: 12 },
      { setNumber: 2, reps: 8, weightKg: 30 },
    ]).exerciseLogs[0];

    expect(averageTargetReps(log)).toBe(11);
    expect(
      averageTargetReps({ ...log, targetReps: undefined, completedSets: sets([8]) }),
    ).toBeUndefined();
  });

  it("skips in-progress sessions", () => {
    expect(
      findComparableLog(
        [session("open", sets([10, 8, 7]), { inProgress: true })],
        benchPress,
      ),
    ).toBeNull();
  });
});
