import {
  ExerciseLog,
  ExercisePrescription,
  exerciseLogFromWorkingSets,
  formatTargetReps,
  setTargetReps,
  targetRepsFields,
  targetRepsForSet,
  targetRepsPerSet,
  targetWeightFields,
  targetWeightKgForSet,
  targetWeightsKg,
} from "./workout.models";

describe("per-set target weights", () => {
  const plain: ExercisePrescription = {
    id: "bench",
    targetWeightKg: 60,
    targetReps: 10,
    targetSets: 3,
    order: 0,
  };
  const pyramid: ExercisePrescription = {
    ...plain,
    setWeightsKg: [60, 70, 80],
  };

  it("uses the target weight for every set without per-set weights", () => {
    expect(targetWeightsKg(plain)).toEqual([60, 60, 60]);
  });

  it("uses each set's own weight when planned per set", () => {
    expect(targetWeightsKg(pyramid)).toEqual([60, 70, 80]);
    expect(targetWeightKgForSet(pyramid, 2)).toBe(80);
  });

  it("falls back to the target weight past the planned weights", () => {
    expect(targetWeightKgForSet({ ...pyramid, targetSets: 4 }, 3)).toBe(60);
  });

  it("stores one weight when every set is the same", () => {
    expect(targetWeightFields([60, 60, 60])).toEqual({ targetWeightKg: 60 });
  });

  it("stores each set's weight when they differ", () => {
    expect(targetWeightFields([60, 70, 80])).toEqual({
      targetWeightKg: 60,
      setWeightsKg: [60, 70, 80],
    });
  });
});

describe("per-set target reps", () => {
  const plain: ExercisePrescription = {
    id: "bench",
    targetWeightKg: 60,
    targetReps: 10,
    targetSets: 3,
    order: 0,
  };
  const pyramid: ExercisePrescription = { ...plain, setReps: [12, 10, 8] };

  it("uses the target reps for every set on routines saved without per-set reps", () => {
    expect(targetRepsPerSet(plain)).toEqual([10, 10, 10]);
  });

  it("uses each set's own reps when planned per set", () => {
    expect(targetRepsPerSet(pyramid)).toEqual([12, 10, 8]);
    expect(targetRepsForSet(pyramid, 2)).toBe(8);
  });

  it("stores one rep target when every set is the same", () => {
    expect(targetRepsFields([10, 10, 10])).toEqual({ targetReps: 10 });
  });

  it("stores each set's reps when they differ, keeping the first as targetReps", () => {
    expect(targetRepsFields([12, 10, 8])).toEqual({
      targetReps: 12,
      setReps: [12, 10, 8],
    });
  });

  it("formats reps as one number or each set's", () => {
    expect(formatTargetReps([10, 10])).toBe("10");
    expect(formatTargetReps([12, 10, 8])).toBe("12/10/8");
  });
});

describe("logged set targets", () => {
  it("uses the set's own target", () => {
    const log: ExerciseLog = {
      exerciseId: "bench",
      exerciseName: "Bench",
      targetReps: 12,
      completedSets: [{ setNumber: 2, reps: 9, weightKg: 60, targetReps: 10 }],
    };
    expect(setTargetReps(log, log.completedSets[0])).toBe(10);
  });

  it("falls back to the log's target on logs saved before per-set targets", () => {
    const log: ExerciseLog = {
      exerciseId: "bench",
      exerciseName: "Bench",
      targetReps: 10,
      completedSets: [{ setNumber: 1, reps: 9, weightKg: 60 }],
    };
    expect(setTargetReps(log, log.completedSets[0])).toBe(10);
  });

  it("has no target on logs saved before targets were recorded", () => {
    const log: ExerciseLog = {
      exerciseId: "bench",
      exerciseName: "Bench",
      completedSets: [{ setNumber: 1, reps: 9, weightKg: 60 }],
    };
    expect(setTargetReps(log, log.completedSets[0])).toBeUndefined();
  });

  it("stamps each saved set with its planned reps by position, dropping empty sets", () => {
    const log = exerciseLogFromWorkingSets(
      {
        id: "bench",
        name: "Bench",
        targetWeightKg: 60,
        targetReps: 12,
        setReps: [12, 10, 8],
        targetSets: 3,
        order: 0,
      },
      [
        { setNumber: 1, reps: 12, weightKg: 60 },
        { setNumber: 2, reps: 0, weightKg: 60 },
        { setNumber: 3, reps: 7, weightKg: 60 },
      ],
    );

    expect(log.targetReps).toBe(12);
    expect(log.targetSets).toBe(3);
    expect(log.completedSets).toEqual([
      { setNumber: 1, reps: 12, weightKg: 60, targetReps: 12 },
      { setNumber: 3, reps: 7, weightKg: 60, targetReps: 8 },
    ]);
  });
});
