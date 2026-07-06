import { Injectable, signal } from "@angular/core";
import { Observable, from, map } from "rxjs";
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  writeBatch,
} from "@angular/fire/firestore";
import { Auth } from "@angular/fire/auth";
import {
  Routine,
  WorkoutSession,
  TodayWorkout,
  ExerciseLog,
  CompletedSet,
} from "../models/workout.models";

/** Serializable snapshot of an in-progress Today session for restore after navigation. */
export interface InProgressState {
  today: TodayWorkout;
  completedExerciseIds: string[];
  activeExerciseId: string | null;
  workingSets: { exerciseId: string; sets: CompletedSet[] }[];
}

@Injectable({ providedIn: "root" })
export class WorkoutService {
  /** Reactive cache of all sessions — updated after every read/write. */
  readonly sessionsSignal = signal<WorkoutSession[]>([]);

  /** Reactive cache of all routines — updated after every read/write. */
  readonly routinesSignal = signal<Routine[]>([]);

  constructor(
    private firestore: Firestore,
    private auth: Auth,
  ) {}

  // transient in-memory store for an in-progress session; persisted to sessionStorage
  private inProgressState: InProgressState | null = null;

  saveInProgressState(state: InProgressState | null): void {
    this.inProgressState = state;
    try {
      if (state === null) {
        sessionStorage.removeItem("gym:inProgressState");
      } else {
        // Convert any Maps (notably TodayWorkout.lastPerformance) into serializable form.
        // Use a shallow-clone to avoid relying on structuredClone availability.
        const serializable: any = {
          ...state,
          today: state.today ? { ...state.today } : state.today,
        };
        try {
          const lp = (serializable as any).today?.lastPerformance;
          if (lp instanceof Map) {
            (serializable as any).today.lastPerformance = Array.from(
              lp.entries(),
            );
          }
        } catch (e) {
          // ignore
        }
        sessionStorage.setItem(
          "gym:inProgressState",
          JSON.stringify(serializable),
        );
      }
    } catch (e) {
      // ignore storage errors
    }
  }

  getInProgressState(): InProgressState | null {
    if (this.inProgressState) return this.inProgressState;
    try {
      const raw = sessionStorage.getItem("gym:inProgressState");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as any;
      // Restore Map for today.lastPerformance if it was serialized as entries array or object
      try {
        if (parsed?.today?.lastPerformance) {
          const lp = parsed.today.lastPerformance;
          if (Array.isArray(lp)) {
            parsed.today.lastPerformance = new Map(lp);
          } else if (typeof lp === "object") {
            parsed.today.lastPerformance = new Map(Object.entries(lp));
          }
        }
      } catch (e) {
        // ignore
      }
      this.inProgressState = parsed as InProgressState;
      return this.inProgressState;
    } catch (e) {
      return null;
    }
  }

  clearInProgressState(): void {
    this.saveInProgressState(null);
  }

  private get uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated");
    return uid;
  }

  private routinesCol() {
    return collection(this.firestore, `users/${this.uid}/routines`);
  }

  private sessionsCol() {
    return collection(this.firestore, `users/${this.uid}/sessions`);
  }

  // ---- reads ------------------------------------------------------------

  getTodayWorkout(): Observable<TodayWorkout> {
    return from(this._getTodayWorkout());
  }

  /**
   * Returns all routines along with which one is up next in the rotation.
   * Used by the Today tab workout-picker screen.
   */
  getRoutinesWithNext(): Observable<{
    routines: Routine[];
    nextRoutineId: string;
  }> {
    return from(
      Promise.all([this._fetchRoutines(), this._fetchSessions()]).then(
        ([routines, sessions]) => {
          this.routinesSignal.set(routines);
          this.sessionsSignal.set(sessions);
          const next = this._determineNextRoutine(routines, sessions);
          return { routines, nextRoutineId: next.id };
        },
      ),
    );
  }

  /** Builds a TodayWorkout for a specific routine (used when user manually picks). */
  getWorkoutForRoutine(routineId: string): Observable<TodayWorkout> {
    return from(
      Promise.all([this._fetchRoutines(), this._fetchSessions()]).then(
        ([routines, sessions]) => {
          this.routinesSignal.set(routines);
          this.sessionsSignal.set(sessions);
          const routine = routines.find((r) => r.id === routineId);
          if (!routine) throw new Error("Routine not found");
          const sessionsForRoutine = sessions.filter(
            (s) => s.routineId === routine.id && !s.inProgress,
          );
          const lastPerformance =
            this._buildLastPerformanceMap(sessionsForRoutine);
          return {
            routine,
            previousSession: sessionsForRoutine[0] ?? null,
            lastPerformance,
          } as TodayWorkout;
        },
      ),
    );
  }

  getAllRoutines(): Observable<Routine[]> {
    return from(this._fetchRoutines()).pipe(
      map((routines) => {
        this.routinesSignal.set(routines);
        return routines;
      }),
    );
  }

  getSessionHistory(): Observable<WorkoutSession[]> {
    return from(this._fetchSessions()).pipe(
      map((sessions) => {
        this.sessionsSignal.set(sessions);
        return sessions;
      }),
    );
  }

  getExerciseHistory(
    exerciseId: string,
  ): Observable<{ date: string; log: ExerciseLog }[]> {
    return from(this._fetchSessions()).pipe(
      map((sessions) =>
        sessions
          .filter((s) => !s.inProgress)
          .flatMap((s) => {
            const log = s.exerciseLogs.find((l) => l.exerciseId === exerciseId);
            return log ? [{ date: s.date, log }] : [];
          }),
      ),
    );
  }

  getSessionDates(): Observable<string[]> {
    return from(this._fetchSessions()).pipe(
      map((sessions) =>
        sessions.filter((s) => !s.inProgress).map((s) => s.date),
      ),
    );
  }

  getSessionById(sessionId: string): Observable<WorkoutSession | null> {
    return from(
      getDoc(doc(this.sessionsCol(), sessionId)).then((snap) =>
        snap.exists() ? (snap.data() as WorkoutSession) : null,
      ),
    );
  }

  getRoutineById(id: string): Observable<Routine | null> {
    return from(
      getDoc(doc(this.routinesCol(), id)).then((snap) =>
        snap.exists() ? (snap.data() as Routine) : null,
      ),
    );
  }

  // ---- writes -----------------------------------------------------------

  saveSession(session: WorkoutSession): Observable<WorkoutSession> {
    return from(
      setDoc(doc(this.sessionsCol(), session.id), session).then(() => {
        const current = this.sessionsSignal();
        const idx = current.findIndex((s) => s.id === session.id);
        if (idx >= 0) {
          const updated = [...current];
          updated[idx] = session;
          this.sessionsSignal.set(updated);
        } else {
          this.sessionsSignal.set([session, ...current]);
        }
        return session;
      }),
    );
  }

  saveRoutine(routine: Routine): Observable<Routine> {
    return from(this._saveRoutine(routine));
  }

  deleteRoutine(id: string): Observable<boolean> {
    return from(this._deleteRoutine(id));
  }

  // ---- id generators ----------------------------------------------------

  generateSessionId(): string {
    return doc(this.sessionsCol()).id;
  }

  generateRoutineId(): string {
    return doc(this.routinesCol()).id;
  }

  generateExerciseId(): string {
    // Re-uses the auto-ID mechanism; the doc is never actually written.
    return doc(collection(this.firestore, `users/${this.uid}/exercises`)).id;
  }

  // ---- internal helpers -------------------------------------------------

  private async _fetchRoutines(): Promise<Routine[]> {
    const snap = await getDocs(
      query(this.routinesCol(), orderBy("rotationOrder")),
    );
    return snap.docs.map((d) => d.data() as Routine);
  }

  private async _fetchSessions(): Promise<WorkoutSession[]> {
    const snap = await getDocs(
      query(this.sessionsCol(), orderBy("date", "desc")),
    );
    return snap.docs.map((d) => d.data() as WorkoutSession);
  }

  private async _getTodayWorkout(): Promise<TodayWorkout> {
    const [routines, sessions] = await Promise.all([
      this._fetchRoutines(),
      this._fetchSessions(),
    ]);
    this.routinesSignal.set(routines);
    this.sessionsSignal.set(sessions);

    const nextRoutine = this._determineNextRoutine(routines, sessions);
    const sessionsForRoutine = sessions.filter(
      (s) => s.routineId === nextRoutine.id && !s.inProgress,
    );
    // sessions are already newest-first from the query
    const previousSession = sessionsForRoutine[0] ?? null;
    const lastPerformance = this._buildLastPerformanceMap(sessionsForRoutine);

    return { routine: nextRoutine, previousSession, lastPerformance };
  }

  private async _saveRoutine(routine: Routine): Promise<Routine> {
    const current = [...this.routinesSignal()];
    const idx = current.findIndex((r) => r.id === routine.id);
    if (idx >= 0) {
      current[idx] = routine;
    } else {
      current.push(routine);
    }
    current.forEach((r, i) => {
      r.rotationOrder = i;
    });

    const batch = writeBatch(this.firestore);
    for (const r of current) {
      batch.set(doc(this.routinesCol(), r.id), r);
    }
    await batch.commit();
    this.routinesSignal.set([...current]);
    return routine;
  }

  private async _deleteRoutine(id: string): Promise<boolean> {
    const remaining = [...this.routinesSignal()].filter((r) => r.id !== id);
    remaining.forEach((r, i) => {
      r.rotationOrder = i;
    });

    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.routinesCol(), id));
    for (const r of remaining) {
      batch.set(doc(this.routinesCol(), r.id), r);
    }
    await batch.commit();
    this.routinesSignal.set([...remaining]);
    return true;
  }

  private _determineNextRoutine(
    routines: Routine[],
    sessions: WorkoutSession[],
  ): Routine {
    if (routines.length === 0) throw new Error("No routines found");

    const completed = sessions
      .filter((s) => !s.inProgress)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (completed.length === 0) {
      return routines.find((r) => r.rotationOrder === 0) ?? routines[0];
    }

    const lastRoutine = routines.find((r) => r.id === completed[0].routineId);
    if (!lastRoutine) {
      return routines.find((r) => r.rotationOrder === 0) ?? routines[0];
    }

    const maxOrder = Math.max(...routines.map((r) => r.rotationOrder));
    const nextOrder =
      lastRoutine.rotationOrder === maxOrder
        ? 0
        : lastRoutine.rotationOrder + 1;
    return routines.find((r) => r.rotationOrder === nextOrder) ?? routines[0];
  }

  private _buildLastPerformanceMap(
    sessionsNewestFirst: WorkoutSession[],
  ): Map<string, ExerciseLog> {
    const map = new Map<string, ExerciseLog>();
    // Walk oldest→newest so newer logs overwrite older ones.
    for (const session of [...sessionsNewestFirst].reverse()) {
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
  return Array.from({ length: count }, (_, i) => ({
    setNumber: i + 1,
    reps: 0,
    weightKg: 0,
  }));
}
