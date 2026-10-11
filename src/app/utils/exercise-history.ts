import { ExerciseHistoryEntry } from "../models/workout.models";
import { estimatedOneRepMax, findPersonalRecords } from "./personal-records";

export interface ExerciseHistoryItem extends ExerciseHistoryEntry {
  /** True when this session set any personal record for the exercise. */
  isRecord: boolean;
}

export interface ExerciseHistorySummary {
  lastDate: string;
  /** 0 when no set had weight, e.g. bodyweight exercises. */
  heaviestKg: number;
  bestOneRepMaxKg: number;
}

/**
 * Flags the sessions that set a personal record, each judged against the
 * sessions before it. Takes and returns entries newest first.
 */
export function markRecordSessions(
  entriesNewestFirst: readonly ExerciseHistoryEntry[],
): ExerciseHistoryItem[] {
  return entriesNewestFirst.map((entry, index) => ({
    ...entry,
    isRecord:
      findPersonalRecords(
        entry.log,
        entriesNewestFirst.slice(index + 1).map((earlier) => earlier.log),
      ).length > 0,
  }));
}

/**
 * Splits entries (newest first) into calendar months (YYYY-MM), newest first.
 */
export function groupByMonth<T extends { date: string }>(
  entriesNewestFirst: readonly T[],
): { month: string; items: T[] }[] {
  const months: { month: string; items: T[] }[] = [];
  for (const entry of entriesNewestFirst) {
    const month = entry.date.slice(0, 7);
    const current = months.at(-1);
    if (current?.month === month) {
      current.items.push(entry);
    } else {
      months.push({ month, items: [entry] });
    }
  }
  return months;
}

/** Headline numbers across every session, or null when there are none. */
export function summarizeHistory(
  entriesNewestFirst: readonly ExerciseHistoryEntry[],
): ExerciseHistorySummary | null {
  if (entriesNewestFirst.length === 0) return null;
  const sets = entriesNewestFirst.flatMap((entry) => entry.log.completedSets);
  return {
    lastDate: entriesNewestFirst[0].date,
    heaviestKg: Math.max(0, ...sets.map((set) => set.weightKg)),
    bestOneRepMaxKg: Math.max(0, ...sets.map(estimatedOneRepMax)),
  };
}
