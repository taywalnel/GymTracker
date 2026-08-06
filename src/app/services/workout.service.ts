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
import { Auth, user } from "@angular/fire/auth";
import {
  Routine,
  StoredRoutine,
  Exercise,
  ExercisePrescription,
  WorkoutSession,
  TodayWorkout,
  ExerciseLog,
  CompletedSet,
} from "../models/workout.models";

/** Serializable snapshot of an in-progress Today session for restore after navigation. */
export interface InProgressState {
  today: TodayWorkout;
  startedAt: number;
  completedExerciseIds: string[];
  activeExerciseId: string | null;
  workingSets: { exerciseId: string; sets: CompletedSet[] }[];
  progressionSuggestedExerciseIds?: string[];
  ownerUid?: string;
}

@Injectable({ providedIn: "root" })
export class WorkoutService {
  /** Reactive cache of all sessions — updated after every read/write. */
  readonly sessionsSignal = signal<WorkoutSession[]>([]);

  /** Reactive cache of all routines — updated after every read/write. */
  readonly routinesSignal = signal<Routine[]>([]);

  /** Reactive cache of the user's reusable exercise catalog. */
  readonly exercisesSignal = signal<Exercise[]>([]);

  private routinesLoaded = false;
  private sessionsLoaded = false;
  private exercisesLoaded = false;
  private routinesLoad: Promise<Routine[]> | null = null;
  private sessionsLoad: Promise<WorkoutSession[]> | null = null;
  private exercisesLoad: Promise<Exercise[]> | null = null;
  private activeUserId: string | null = null;
  private authStateInitialized = false;

  constructor(
    private firestore: Firestore,
    private auth: Auth,
  ) {
    user(this.auth).subscribe((currentUser) => {
      const userId = currentUser?.uid ?? null;
      if (!this.authStateInitialized) {
        this.activeUserId = userId;
        this.authStateInitialized = true;
        return;
      }
      if (this.activeUserId !== userId) {
        this.activeUserId = userId;
        this._clearDataCache();
        this.clearInProgressState();
      }
    });
  }

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
          ownerUid: this.auth.currentUser?.uid,
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
      if (parsed.ownerUid && parsed.ownerUid !== this.auth.currentUser?.uid) {
        this.clearInProgressState();
        return null;
      }
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

  private exercisesCol() {
    return collection(this.firestore, `users/${this.uid}/exercises`);
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
    return from(this._getRoutinesWithNext());
  }

  /** Builds a TodayWorkout for a specific routine (used when user manually picks). */
  getWorkoutForRoutine(routineId: string): Observable<TodayWorkout> {
    return from(
      this._loadRoutinesAndSessions().then(([routines, sessions]) => {
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
      }),
    );
  }

  getAllRoutines(): Observable<Routine[]> {
    return from(this._loadRoutines());
  }

  getAllExercises(): Observable<Exercise[]> {
    return from(this._loadExercises());
  }

  getExerciseCount(): Observable<number> {
    return from(
      this._loadRoutines().then(
        (routines) =>
          new Set(
            routines.flatMap((routine) =>
              routine.exercises.map((exercise) => exercise.id),
            ),
          ).size,
      ),
    );
  }

  getSessionHistory(): Observable<WorkoutSession[]> {
    return from(this._loadSessions());
  }

  getExerciseHistory(
    exerciseId: string,
  ): Observable<{ date: string; log: ExerciseLog }[]> {
    return from(this._loadSessions()).pipe(
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
    return from(this._loadSessions()).pipe(
      map((sessions) =>
        sessions.filter((s) => !s.inProgress).map((s) => s.date),
      ),
    );
  }

  getSessionById(sessionId: string): Observable<WorkoutSession | null> {
    if (this.sessionsLoaded) {
      return from(
        Promise.resolve(
          this.sessionsSignal().find((session) => session.id === sessionId) ??
            null,
        ),
      );
    }

    return from(
      getDoc(doc(this.sessionsCol(), sessionId)).then((snap) => {
        if (!snap.exists()) return null;
        const session = snap.data() as WorkoutSession;
        this._upsertSession(session);
        return session;
      }),
    );
  }

  getRoutineById(id: string): Observable<Routine | null> {
    if (this.routinesLoaded) {
      return from(
        Promise.resolve(
          this.routinesSignal().find((routine) => routine.id === id) ?? null,
        ),
      );
    }

    return from(
      Promise.all([
        getDoc(doc(this.routinesCol(), id)),
        this._loadExercises(),
      ]).then(([snap, exercises]) => {
        if (!snap.exists()) return null;
        const routine = this._resolveRoutine(
          snap.data() as StoredRoutine,
          exercises,
        );
        this._upsertRoutine(routine);
        return routine;
      }),
    );
  }

  // ---- writes -----------------------------------------------------------

  saveSession(session: WorkoutSession): Observable<WorkoutSession> {
    return from(
      setDoc(doc(this.sessionsCol(), session.id), session).then(() => {
        this._upsertSession(session);
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

  private _loadRoutines(): Promise<Routine[]> {
    if (this.routinesLoaded) {
      return Promise.resolve(this.routinesSignal());
    }
    if (this.routinesLoad) return this.routinesLoad;

    const load = Promise.all([
      getDocs(query(this.routinesCol(), orderBy("rotationOrder"))),
      this._loadExercises(),
    ]).then(([snap, exercises]) => {
      const routines = snap.docs.map((item) =>
        this._resolveRoutine(item.data() as StoredRoutine, exercises),
      );
      this.routinesSignal.set(routines);
      this.routinesLoaded = true;
      return routines;
    });
    this.routinesLoad = load;
    void load.then(
      () => this._clearRoutineLoad(load),
      () => this._clearRoutineLoad(load),
    );
    return load;
  }

  private _loadExercises(): Promise<Exercise[]> {
    if (this.exercisesLoaded) {
      return Promise.resolve(this.exercisesSignal());
    }
    if (this.exercisesLoad) return this.exercisesLoad;

    const load = getDocs(this.exercisesCol()).then((snap) => {
      const exercises = snap.docs.map((item) => item.data() as Exercise);
      this.exercisesSignal.set(exercises);
      this.exercisesLoaded = true;
      return exercises;
    });
    this.exercisesLoad = load;
    void load.then(
      () => this._clearExerciseLoad(load),
      () => this._clearExerciseLoad(load),
    );
    return load;
  }

  private _loadSessions(): Promise<WorkoutSession[]> {
    if (this.sessionsLoaded) {
      return Promise.resolve(this.sessionsSignal());
    }
    if (this.sessionsLoad) return this.sessionsLoad;

    const load = getDocs(
      query(this.sessionsCol(), orderBy("date", "desc")),
    ).then((snap) => {
      const sessions = snap.docs.map((item) => item.data() as WorkoutSession);
      this.sessionsSignal.set(sessions);
      this.sessionsLoaded = true;
      return sessions;
    });
    this.sessionsLoad = load;
    void load.then(
      () => this._clearSessionLoad(load),
      () => this._clearSessionLoad(load),
    );
    return load;
  }

  private _loadRoutinesAndSessions(): Promise<[Routine[], WorkoutSession[]]> {
    return Promise.all([this._loadRoutines(), this._loadSessions()]);
  }

  private async _getRoutinesWithNext(): Promise<{
    routines: Routine[];
    nextRoutineId: string;
  }> {
    const [routines, sessions] = await this._loadRoutinesAndSessions();
    const next = this._determineNextRoutine(routines, sessions);
    return { routines, nextRoutineId: next.id };
  }

  private async _getTodayWorkout(): Promise<TodayWorkout> {
    const [routines, sessions] = await this._loadRoutinesAndSessions();

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
    const current = [...(await this._loadRoutines())];
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
      for (const exercise of r.exercises) {
        batch.set(doc(this.exercisesCol(), exercise.id), {
          id: exercise.id,
          name: exercise.name,
        });
      }
      batch.set(doc(this.routinesCol(), r.id), this._storeRoutine(r));
    }
    await batch.commit();
    this.routinesSignal.set([...current]);
    this.routinesLoaded = true;
    this._setExercisesFromRoutines(current);
    return routine;
  }

  private async _deleteRoutine(id: string): Promise<boolean> {
    const remaining = [...(await this._loadRoutines())].filter(
      (routine) => routine.id !== id,
    );
    remaining.forEach((r, i) => {
      r.rotationOrder = i;
    });

    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.routinesCol(), id));
    for (const r of remaining) {
      batch.set(doc(this.routinesCol(), r.id), this._storeRoutine(r));
    }
    await batch.commit();
    this.routinesSignal.set([...remaining]);
    this.routinesLoaded = true;
    return true;
  }

  private _upsertSession(session: WorkoutSession): void {
    const sessions = this.sessionsSignal().filter(
      (item) => item.id !== session.id,
    );
    sessions.push(session);
    sessions.sort((left, right) => right.date.localeCompare(left.date));
    this.sessionsSignal.set(sessions);
  }

  private _upsertRoutine(routine: Routine): void {
    const routines = this.routinesSignal().filter(
      (item) => item.id !== routine.id,
    );
    routines.push(routine);
    routines.sort((left, right) => left.rotationOrder - right.rotationOrder);
    this.routinesSignal.set(routines);
  }

  private _clearRoutineLoad(load: Promise<Routine[]>): void {
    if (this.routinesLoad === load) this.routinesLoad = null;
  }

  private _clearSessionLoad(load: Promise<WorkoutSession[]>): void {
    if (this.sessionsLoad === load) this.sessionsLoad = null;
  }

  private _clearExerciseLoad(load: Promise<Exercise[]>): void {
    if (this.exercisesLoad === load) this.exercisesLoad = null;
  }

  private _clearDataCache(): void {
    this.routinesSignal.set([]);
    this.sessionsSignal.set([]);
    this.exercisesSignal.set([]);
    this.routinesLoaded = false;
    this.sessionsLoaded = false;
    this.exercisesLoaded = false;
    this.routinesLoad = null;
    this.sessionsLoad = null;
    this.exercisesLoad = null;
  }

  private _resolveRoutine(
    routine: StoredRoutine,
    exercises: Exercise[],
  ): Routine {
    const namesById = new Map(
      exercises.map((exercise) => [exercise.id, exercise.name]),
    );
    return {
      ...routine,
      exercises: routine.exercises.map((exercise) => {
        const legacyName = (
          exercise as ExercisePrescription & { name?: string }
        ).name;
        const name = namesById.get(exercise.id) ?? legacyName;
        if (!name) {
          throw new Error(
            `Exercise ${exercise.id} is missing from the exercise catalog`,
          );
        }
        return { ...exercise, name };
      }),
    };
  }

  private _storeRoutine(routine: Routine): StoredRoutine {
    return {
      ...routine,
      exercises: routine.exercises.map(
        ({ name: _name, ...exercise }) => exercise,
      ),
    };
  }

  private _setExercisesFromRoutines(routines: Routine[]): void {
    const namesById = new Map(
      this.exercisesSignal().map((exercise) => [exercise.id, exercise]),
    );
    for (const routine of routines) {
      for (const exercise of routine.exercises) {
        namesById.set(exercise.id, { id: exercise.id, name: exercise.name });
      }
    }
    this.exercisesSignal.set([...namesById.values()]);
    this.exercisesLoaded = true;
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
