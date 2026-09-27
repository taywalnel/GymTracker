import {
  CompletedSet,
  ExerciseLog,
  WorkoutSession,
} from "../models/workout.models";
import {
  estimatedOneRepMax,
  findPersonalRecords,
  findSessionRecords,
  sessionVolume,
} from "./personal-records";

describe("personal records", () => {
  function sets(reps: number[], weightKg: number): CompletedSet[] {
    return reps.map((count, index) => ({
      setNumber: index + 1,
      reps: count,
      weightKg,
    }));
  }

  function log(
    completedSets: CompletedSet[],
    exerciseId = "bench",
  ): ExerciseLog {
    return { exerciseId, exerciseName: "Bench", completedSets };
  }

  function session(
    id: string,
    date: string,
    exerciseLogs: ExerciseLog[],
  ): WorkoutSession {
    return {
      id,
      routineId: "push",
      routineName: "Push",
      date,
      exerciseLogs,
      inProgress: false,
    };
  }

  const kinds = (items: { kind: string }[]) => items.map((item) => item.kind);

  it("sets no records on an exercise's first log", () => {
    expect(findPersonalRecords(log(sets([10, 10], 60)), [])).toEqual([]);
  });

  it("sets no records on a tie", () => {
    const same = log(sets([10, 10], 60));
    expect(findPersonalRecords(same, [log(sets([10, 10], 60))])).toEqual([]);
  });

  it("records a heavier weight with its previous best", () => {
    const records = findPersonalRecords(log(sets([8], 62.5)), [
      log(sets([8], 60)),
    ]);

    expect(records).toContain({
      kind: "heaviestWeight",
      value: 62.5,
      previous: 60,
    });
    expect(kinds(records)).not.toContain("repsAtWeight");
  });

  it("records more reps at a weight lifted before", () => {
    const records = findPersonalRecords(log(sets([11, 10, 10], 60)), [
      log(sets([10, 10, 10], 60)),
    ]);

    expect(records).toContain({
      kind: "repsAtWeight",
      value: 11,
      previous: 10,
      weightKg: 60,
    });
    expect(kinds(records)).toEqual([
      "estimatedOneRepMax",
      "repsAtWeight",
      "sessionVolume",
    ]);
  });

  it("counts reps done at a heavier weight against a rep record", () => {
    const records = findPersonalRecords(log(sets([8], 50)), [
      log(sets([8], 60)),
    ]);
    expect(kinds(records)).not.toContain("repsAtWeight");
  });

  it("ignores lb-to-kg rounding", () => {
    // 135 lb entered twice can be stored a hair apart.
    const records = findPersonalRecords(log(sets([5], 61.235)), [
      log(sets([5], 61.2349)),
    ]);
    expect(records).toEqual([]);
  });

  it("records reps on bodyweight exercises", () => {
    const records = findPersonalRecords(log(sets([12], 0)), [
      log(sets([10], 0)),
    ]);
    expect(kinds(records)).toEqual(["repsAtWeight"]);
  });

  it("matches the Epley estimate and volume used by the progression chart", () => {
    expect(estimatedOneRepMax({ setNumber: 1, reps: 30, weightKg: 50 })).toBe(
      100,
    );
    expect(sessionVolume(log(sets([10, 8], 50)))).toBe(900);
  });

  describe("for a session", () => {
    const older = session("a", "2026-09-01", [log(sets([10], 60))]);
    const newer = session("b", "2026-09-08", [
      log(sets([10], 65)),
      log(sets([5], 20), "curl"),
    ]);
    const newest = session("c", "2026-09-15", [log(sets([10], 70))]);

    it("only compares with sessions before it", () => {
      const records = findSessionRecords(newer, [newest, newer, older]);

      expect(records.length).toBe(1);
      expect(records[0].exerciseId).toBe("bench");
      expect(records[0].records).toContain({
        kind: "heaviestWeight",
        value: 65,
        previous: 60,
      });
    });

    it("leaves out exercises with no records", () => {
      const records = findSessionRecords(newer, [newest, newer, older]);
      expect(records.map((item) => item.exerciseId)).not.toContain("curl");
    });

    it("ignores in-progress sessions", () => {
      const inProgress = { ...older, inProgress: true };
      expect(findSessionRecords(newer, [newer, inProgress])).toEqual([]);
    });
  });
});
