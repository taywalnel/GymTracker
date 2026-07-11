import { Component, OnDestroy, OnInit } from "@angular/core";
import { DatePipe } from "@angular/common";
import { Router } from "@angular/router";
import {
  TodayWorkout,
  WorkoutSession,
  ExerciseLog,
  CompletedSet,
  Routine,
} from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { TabService } from "../../services/tab.service";
import { ExerciseCardComponent } from "../exercise-card/exercise-card.component";
import { NavDotsComponent, NavDotItem } from "../nav-dots/nav-dots.component";
import { ButtonComponent } from "../button/button.component";

@Component({
    selector: "app-today-workout",
    imports: [
    ExerciseCardComponent,
    NavDotsComponent,
    ButtonComponent
],
    templateUrl: "./today-workout.component.html",
    styleUrl: "./today-workout.component.scss"
})
export class TodayWorkoutComponent implements OnInit, OnDestroy {
  today: TodayWorkout | null = null;
  isLoading = true;
  isSaving = false;
  noRoutines = false;

  /** All routines shown in the picker, null while loading */
  allRoutines: Routine[] = [];
  /** The routine that would be next in rotation */
  nextRoutineId: string | null = null;
  /** Whether the user is on the workout-picker screen (vs. actively working out) */
  isPickerMode = true;

  get featuredRoutine(): Routine | null {
    return this.allRoutines.find((r) => r.id === this.nextRoutineId) ?? null;
  }

  get otherRoutines(): Routine[] {
    // If there's an in-progress saved session, exclude that routine from the "other" list.
    // Otherwise, exclude the featured (next) routine.
    const saved = this.savedState ?? this.workoutService.getInProgressState?.();
    const excludeId =
      saved && saved.today && saved.today.routine?.id
        ? saved.today.routine.id
        : this.nextRoutineId;
    if (!excludeId) return this.allRoutines.slice();
    return this.allRoutines.filter((r) => r.id !== excludeId);
  }

  /** Tracks which exercises have been marked done this session, by exercise id */
  completedExerciseIds = new Set<string>();
  /** When set, overrides auto-advance and shows this exercise */
  activeExerciseId: string | null = null;
  /** Working copy of sets per exercise id, kept in sync as the person types */
  workingSetsByExerciseId = new Map<string, CompletedSet[]>();

  todayDateLabel = "";
  currentTime = "";
  private clockInterval: ReturnType<typeof setInterval> | null = null;
  /** In-progress snapshot restored from the service (if any) */
  savedState: any = null;
  private _tabSub: any = null;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private restTimer: RestTimerService,
    private tabService: TabService,
  ) {}

  ngOnInit(): void {
    this.todayDateLabel = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    this.updateTime();
    this.clockInterval = setInterval(() => this.updateTime(), 1000);
    // If there is an in-progress session, restore it instead of showing the picker.
    const saved = this.workoutService.getInProgressState?.();
    this.savedState = saved ?? null;
    if (saved && saved.today) {
      this.restoreFromSavedState(saved);
      // still refresh routines in background for the picker
      this.loadToday();
    } else {
      this.loadToday();
    }

    // Subscribe to Today tab clicks so we can return to the picker when requested
    this._tabSub = this.tabService.todayClick$?.subscribe(() => {
      // If currently viewing a workout (not the picker), go back to picker
      if (!this.isPickerMode) this.backToPicker();
    });
  }

  ngOnDestroy(): void {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
    }
    if (this._tabSub) this._tabSub.unsubscribe();
  }

  private updateTime(): void {
    this.currentTime = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  private loadToday(): void {
    this.isLoading = true;
    this.noRoutines = false;
    this.workoutService.getRoutinesWithNext().subscribe({
      next: ({ routines, nextRoutineId }) => {
        this.allRoutines = routines;
        this.nextRoutineId = nextRoutineId;
        this.isLoading = false;
        // Only show the picker if there is no saved in-progress session.
        const saved = this.workoutService.getInProgressState?.();
        if (!saved) this.isPickerMode = true;
      },
      error: (err: Error) => {
        this.isLoading = false;
        if (err?.message === "No routines found") {
          this.noRoutines = true;
        }
      },
    });
  }

  selectRoutine(routine: Routine): void {
    this.isLoading = true;
    this.workoutService.getWorkoutForRoutine(routine.id).subscribe({
      next: (today) => {
        this.today = today;
        this.isLoading = false;
        this.isPickerMode = false;
        // Reset per-session state
        this.completedExerciseIds = new Set();
        this.activeExerciseId = null;
        this.workingSetsByExerciseId = new Map();
        this.persistState();
        this.savedState = this.workoutService.getInProgressState?.() ?? null;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  backToPicker(): void {
    this.today = null;
    this.isPickerMode = true;
    this.completedExerciseIds = new Set();
    this.activeExerciseId = null;
    this.workingSetsByExerciseId = new Map();
    this.savedState = this.workoutService.getInProgressState?.() ?? null;
  }

  get currentExerciseId(): string | null {
    if (!this.today) return null;
    const next = this.today.routine.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((ex) => !this.completedExerciseIds.has(ex.id));
    return next?.id ?? null;
  }

  get currentExercise() {
    if (!this.today) return null;
    const id = this.activeExerciseId ?? this.currentExerciseId;
    return this.today.routine.exercises.find((ex) => ex.id === id) ?? null;
  }

  get exerciseNavItems(): NavDotItem[] {
    if (!this.today) return [];
    return this.today.routine.exercises.map((ex) => ({
      id: ex.id,
      isActive: (this.activeExerciseId ?? this.currentExerciseId) === ex.id,
      isComplete: this.completedExerciseIds.has(ex.id),
      ariaLabel: ex.name,
    }));
  }

  navigateTo(exerciseId: string): void {
    this.activeExerciseId = exerciseId;
    this.persistState();
  }

  get allExercisesComplete(): boolean {
    if (!this.today) return false;
    return this.today.routine.exercises.every((ex) =>
      this.completedExerciseIds.has(ex.id),
    );
  }

  get completedCount(): number {
    return this.completedExerciseIds.size;
  }

  get totalCount(): number {
    return this.today?.routine.exercises.length ?? 0;
  }

  onSetsChanged(exerciseId: string, sets: CompletedSet[]): void {
    this.workingSetsByExerciseId.set(exerciseId, sets);
    this.persistState();
    this.savedState = this.workoutService.getInProgressState?.() ?? null;
  }

  onMarkComplete(exerciseId: string): void {
    this.completedExerciseIds.add(exerciseId);
    this.activeExerciseId = null;
    this.persistState();
    this.savedState = this.workoutService.getInProgressState?.() ?? null;
  }

  /** Persists the whole session (all exercises logged so far) as a finished workout. */
  finishSession(): void {
    if (!this.today) return;
    this.restTimer.clear();
    this.isSaving = true;

    const exerciseLogs: ExerciseLog[] = this.today.routine.exercises.map(
      (ex) => {
        const sets = this.workingSetsByExerciseId.get(ex.id) ?? [];
        const loggedSets = sets.filter((s) => s.reps > 0);
        return {
          exerciseId: ex.id,
          exerciseName: ex.name,
          targetReps: ex.targetReps,
          completedSets: loggedSets,
        };
      },
    );

    const session: WorkoutSession = {
      id: this.workoutService.generateSessionId(),
      routineId: this.today.routine.id,
      routineName: this.today.routine.name,
      date: new Date().toISOString().slice(0, 10),
      exerciseLogs,
      inProgress: false,
    };

    this.workoutService.saveSession(session).subscribe((saved) => {
      this.isSaving = false;
      this.workoutService.clearInProgressState();
      this.savedState = null;
      this.router.navigate(["/history/session", saved.id]);
    });
  }

  private persistState(): void {
    if (!this.today) return;
    const state = {
      today: this.today,
      completedExerciseIds: Array.from(this.completedExerciseIds.values()),
      activeExerciseId: this.activeExerciseId,
      workingSets: Array.from(this.workingSetsByExerciseId.entries()).map(
        ([exerciseId, sets]) => ({ exerciseId, sets }),
      ),
    };
    this.workoutService.saveInProgressState(state);
    this.savedState = this.workoutService.getInProgressState?.() ?? null;
  }

  private restoreFromSavedState(state: any): void {
    this.today = state.today;
    this.isPickerMode = false;
    this.completedExerciseIds = new Set(state.completedExerciseIds ?? []);
    this.activeExerciseId = state.activeExerciseId ?? null;
    this.workingSetsByExerciseId = new Map(
      (state.workingSets ?? []).map((w: any) => [w.exerciseId, w.sets]),
    );
  }

  resumeSaved(): void {
    const saved = this.workoutService.getInProgressState?.();
    if (!saved) return;
    this.restoreFromSavedState(saved);
  }

  get isFeaturedResumable(): boolean {
    try {
      return (
        !!this.savedState &&
        !!this.savedState.today &&
        !!this.featuredRoutine &&
        this.savedState.today.routine?.id === this.featuredRoutine.id
      );
    } catch (e) {
      return false;
    }
  }

  discardSaved(): void {
    this.workoutService.clearInProgressState();
    this.savedState = null;
  }

  get hasAnyProgress(): boolean {
    return (
      this.workingSetsByExerciseId.size > 0 &&
      Array.from(this.workingSetsByExerciseId.values()).some((sets) =>
        sets.some((s) => s.reps > 0),
      )
    );
  }
}
