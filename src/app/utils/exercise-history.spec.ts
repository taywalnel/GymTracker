import { ExerciseHistoryEntry } from "../models/workout.models";
import {
  groupByMonth,
  markRecordSessions,
  summarizeHistory,
} from "./exercise-history";

describe("exercise history", () => {
  function entry(
    sessionId: string,
    date: string,
    reps: number[],
    weightKg: number,
  ): ExerciseHistoryEntry {
    return {
      sessionId,
      date,
      routineName: "Push",
      log: {
        exerciseId: "bench",
        exerciseName: "Bench",
        completedSets: reps.map((count, index) => ({
          setNumber: index + 1,
          reps: count,
          weightKg,
        })),
      },
    };
  }

  describe("markRecordSessions", () => {
    it("flags sessions that beat every earlier one, and never the first", () => {
      const items = markRecordSessions([
        entry("c", "2026-10-08", [8, 8], 60),
        entry("b", "2026-10-04", [8, 8], 62.5),
        entry("a", "2026-10-01", [8, 8], 60),
      ]);

      expect(items.map((item) => item.isRecord)).toEqual([false, true, false]);
    });
  });

  describe("groupByMonth", () => {
    it("groups consecutive entries by month, keeping order", () => {
      const months = groupByMonth([
        { date: "2026-10-08" },
        { date: "2026-10-01" },
        { date: "2026-09-30" },
        { date: "2025-10-12" },
      ]);

      expect(months.map((month) => month.month)).toEqual([
        "2026-10",
        "2026-09",
        "2025-10",
      ]);
      expect(months[0].items.length).toBe(2);
    });
  });

  describe("summarizeHistory", () => {
    it("is null without entries", () => {
      expect(summarizeHistory([])).toBeNull();
    });

    it("takes the latest date and the bests across every session", () => {
      const summary = summarizeHistory([
        entry("b", "2026-10-04", [10], 50),
        entry("a", "2026-10-01", [3], 60),
      ]);

      expect(summary?.lastDate).toBe("2026-10-04");
      expect(summary?.heaviestKg).toBe(60);
      expect(summary?.bestOneRepMaxKg).toBeCloseTo(50 * (1 + 10 / 30));
    });

    it("reports zero weight for bodyweight work", () => {
      expect(
        summarizeHistory([entry("a", "2026-10-01", [12], 0)])?.heaviestKg,
      ).toBe(0);
    });
  });
});
