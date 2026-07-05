import { Component, OnDestroy, OnInit } from "@angular/core";
import { CommonModule, DatePipe } from "@angular/common";
import { Router } from "@angular/router";
import {
  TodayWorkout,
  WorkoutSession,
  ExerciseLog,
  CompletedSet,
} from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { ExerciseCardComponent } from "../exercise-card/exercise-card.component";
import { NavDotsComponent, NavDotItem } from "../nav-dots/nav-dots.component";

@Component({
  selector: "app-today-workout",
  standalone: true,
  imports: [CommonModule, ExerciseCardComponent, NavDotsComponent, DatePipe],
  templateUrl: "./today-workout.component.html",
  styleUrl: "./today-workout.component.scss",
})
export class TodayWorkoutComponent implements OnInit, OnDestroy {
  today: TodayWorkout | null = null;
  isLoading = true;
  isSaving = false;
  noRoutines = false;

  /** Tracks which exercises have been marked done this session, by exercise id */
  completedExerciseIds = new Set<string>();
  /** When set, overrides auto-advance and shows this exercise */
  activeExerciseId: string | null = null;
  /** Working copy of sets per exercise id, kept in sync as the person types */
  workingSetsByExerciseId = new Map<string, CompletedSet[]>();

  todayDateLabel = "";
  currentTime = "";
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private restTimer: RestTimerService,
  ) {}

  ngOnInit(): void {
    this.todayDateLabel = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    this.updateTime();
    this.clockInterval = setInterval(() => this.updateTime(), 1000);
    this.loadToday();
  }

  ngOnDestroy(): void {
    if (this.clockInterval !== null) {
      clearInterval(this.clockInterval);
    }
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
    this.workoutService.getTodayWorkout().subscribe({
      next: (today) => {
        this.today = today;
        this.isLoading = false;
      },
      error: (err: Error) => {
        this.isLoading = false;
        if (err?.message === 'No routines found') {
          this.noRoutines = true;
        }
      },
    });
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
  }

  onMarkComplete(exerciseId: string): void {
    this.completedExerciseIds.add(exerciseId);
    this.activeExerciseId = null;
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
      this.router.navigate(["/history/session", saved.id]);
    });
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
