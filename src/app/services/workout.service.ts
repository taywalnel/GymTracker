import { Injectable, signal } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  Routine,
  WorkoutSession,
  TodayWorkout,
  ExerciseLog,
  CompletedSet,
} from '../models/workout.models';
import { MOCK_ROUTINES, MOCK_SESSIONS } from './mock-data';

/**
 * WorkoutService is the single boundary between the UI and "where data lives".
 *
 * Right now it's backed by in-memory arrays seeded from mock-data.ts.
 * When a real backend exists, every method here gets reimplemented with
 * HttpClient calls (e.g. this.http.get<Routine[]>('/api/routines')) and
 * every component that depends on this service stays untouched, because
 * they only ever talk to these method signatures, never to the mock arrays
 * directly.
 *
 * The artificial `delay(150)` on each call exists so the UI's loading states
 * get exercised now, instead of only appearing once a real network is involved.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private routines: Routine[] = MOCK_ROUTINES;
  private sessions: WorkoutSession[] = [...MOCK_SESSIONS];

  /** Simple reactive cache of all sessions, useful for the history view */
  readonly sessionsSignal = signal<WorkoutSession[]>(this.sessions);

  /**
   * Determine which routine comes next in the rotation, then bundle it with
   * the most recent prior performance for each of its exercises.
   *
   * Rotation logic: find the most recently completed session (by date),
   * look up its routine's rotationOrder, and return the routine at the
   * next rotationOrder (wrapping around). If there's no history at all,
   * start at rotationOrder 0.
   */
  getTodayWorkout(): Observable<TodayWorkout> {
    const nextRoutine = this.determineNextRoutine();
    const previousSession = this.findMostRecentSessionForRoutine(nextRoutine.id);
    const lastPerformance = this.buildLastPerformanceMap(nextRoutine.id);

    const result: TodayWorkout = {
      routine: nextRoutine,
      previousSession,
      lastPerformance,
    };

    return of(result).pipe(delay(150));
  }

  /** All routines, in rotation order. Useful for the rotation tracker UI. */
  getAllRoutines(): Observable<Routine[]> {
    const sorted = [...this.routines].sort((a, b) => a.rotationOrder - b.rotationOrder);
    return of(sorted).pipe(delay(150));
  }

  /** Full session history, most recent first. */
  getSessionHistory(): Observable<WorkoutSession[]> {
    const sorted = [...this.sessions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    return of(sorted).pipe(delay(150));
  }

  /** History of a single exercise across all past sessions, most recent first. */
  getExerciseHistory(exerciseId: string): Observable<{ date: string; log: ExerciseLog }[]> {
    const entries = this.sessions
      .filter((s) => !s.inProgress)
      .map((s) => {
        const log = s.exerciseLogs.find((l) => l.exerciseId === exerciseId);
        return log ? { date: s.date, log } : null;
      })
      .filter((entry): entry is { date: string; log: ExerciseLog } => entry !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return of(entries).pipe(delay(150));
  }

  /**
   * Save a completed (or in-progress) session. If a session with this id
   * already exists, it's updated in place; otherwise it's added.
   */
  saveSession(session: WorkoutSession): Observable<WorkoutSession> {
    const existingIndex = this.sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      this.sessions[existingIndex] = session;
    } else {
      this.sessions.push(session);
    }
    this.sessionsSignal.set([...this.sessions]);
    return of(session).pipe(delay(150));
  }

  /** Generates a fresh session id. Swap for a server-issued id once a backend exists. */
  generateSessionId(): string {
    return `session-${Date.now()}`;
  }

  /**
   * Returns the set of ISO dates (YYYY-MM-DD) on which a session was
   * completed. Used to highlight workout days on the history calendar.
   */
  getSessionDates(): Observable<string[]> {
    const dates = this.sessions.filter((s) => !s.inProgress).map((s) => s.date);
    return of(dates).pipe(delay(150));
  }

  // ---- internal helpers -------------------------------------------------

  private determineNextRoutine(): Routine {
    const sortedByDate = [...this.sessions]
      .filter((s) => !s.inProgress)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (sortedByDate.length === 0) {
      return this.routines.find((r) => r.rotationOrder === 0) ?? this.routines[0];
    }

    const lastRoutine = this.routines.find((r) => r.id === sortedByDate[0].routineId);
    if (!lastRoutine) {
      return this.routines.find((r) => r.rotationOrder === 0) ?? this.routines[0];
    }

    const maxOrder = Math.max(...this.routines.map((r) => r.rotationOrder));
    const nextOrder = lastRoutine.rotationOrder === maxOrder ? 0 : lastRoutine.rotationOrder + 1;
    return this.routines.find((r) => r.rotationOrder === nextOrder) ?? this.routines[0];
  }

  private findMostRecentSessionForRoutine(routineId: string): WorkoutSession | null {
    const matches = this.sessions
      .filter((s) => s.routineId === routineId && !s.inProgress)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return matches[0] ?? null;
  }

  private buildLastPerformanceMap(routineId: string): Map<string, ExerciseLog> {
    const map = new Map<string, ExerciseLog>();
    const sessionsForRoutine = this.sessions
      .filter((s) => s.routineId === routineId && !s.inProgress)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Walk from oldest to newest within the filtered set so newer logs
    // overwrite older ones, leaving the single most recent log per exercise.
    for (const session of [...sessionsForRoutine].reverse()) {
      for (const log of session.exerciseLogs) {
        if (log.completedSets.length > 0) {
          map.set(log.exerciseId, log);
        }
      }
    }
    return map;
  }
}

/** Small helper used by components to build an empty CompletedSet array for a fresh log. */
export function emptySets(count: number): CompletedSet[] {
  return Array.from({ length: count }, (_, i) => ({ setNumber: i + 1, reps: 0, weightKg: 0 }));
}
