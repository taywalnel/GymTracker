import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  CompletedSet,
  ExerciseLog,
  WorkoutSession,
} from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { ButtonComponent } from "../button/button.component";
import { NavDotsComponent, NavDotItem } from "../nav-dots/nav-dots.component";
import { WorkoutProgressComponent } from "../workout-progress/workout-progress.component";

interface CurrentExerciseDisplay {
  id: string;
  name: string;
  setNavItems: NavDotItem[];
}

@Component({
  selector: "app-current-workout",
  imports: [
    RouterLink,
    ButtonComponent,
    NavDotsComponent,
    WorkoutProgressComponent,
  ],
  templateUrl: "./current-workout.component.html",
  styleUrl: "./current-workout.component.scss",
})
export class CurrentWorkoutComponent implements OnInit, OnDestroy {
  state: InProgressState | null = null;
  exercises: CurrentExerciseDisplay[] = [];
  isLoading = true;
  isSaving = false;
  elapsedTime = "00:00:00";
  private elapsedTimeInterval: ReturnType<typeof setInterval> | null = null;

  get completedExerciseCount(): number {
    return this.state?.completedExerciseIds.length ?? 0;
  }

  get totalExerciseCount(): number {
    return this.state?.today.routine.exercises.length ?? 0;
  }

  get completionPercentage(): number {
    return this.totalExerciseCount === 0
      ? 0
      : (this.completedExerciseCount / this.totalExerciseCount) * 100;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    private restTimer: RestTimerService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    const workoutId = this.route.snapshot.paramMap.get("workoutId");
    const state = this.workoutService.getInProgressState();
    if (!state || state.today.routine.id !== workoutId) {
      this.router.navigate(["/"]);
      return;
    }

    this.state = state;
    this.updateElapsedTime();
    this.elapsedTimeInterval = setInterval(
      () => this.updateElapsedTime(),
      1000,
    );
    this.exercises = state.today.routine.exercises
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((exercise) => {
        const sets = this.setsFor(exercise.id);
        return {
          id: exercise.id,
          name: exercise.name,
          setNavItems: Array.from(
            { length: exercise.targetSets },
            (_, index) => {
              const set = sets[index];
              const isComplete = (set?.reps ?? 0) > 0;
              const setNumber = index + 1;
              return {
                id: setNumber,
                isActive: false,
                isComplete,
                isShort: isComplete && set!.reps < exercise.targetReps,
                label: isComplete ? set!.reps : exercise.targetReps,
                ariaLabel: isComplete
                  ? `Set ${setNumber}: ${set!.reps} reps`
                  : `Set ${setNumber}: ${exercise.targetReps} reps planned`,
              };
            },
          ),
        };
      });
    this.isLoading = false;
  }

  ngOnDestroy(): void {
    if (this.elapsedTimeInterval !== null) {
      clearInterval(this.elapsedTimeInterval);
    }
  }

  finishWorkout(): void {
    if (!this.state) return;
    this.isSaving = true;
    this.restTimer.clear();
    const workingSets = new Map<string, CompletedSet[]>(
      this.state.workingSets.map(({ exerciseId, sets }) => [exerciseId, sets]),
    );
    const exerciseLogs: ExerciseLog[] = this.state.today.routine.exercises.map(
      (exercise) => ({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        targetReps: exercise.targetReps,
        completedSets: (workingSets.get(exercise.id) ?? []).filter(
          (set) => set.reps > 0,
        ),
      }),
    );
    const session: WorkoutSession = {
      id: this.workoutService.generateSessionId(),
      routineId: this.state.today.routine.id,
      routineName: this.state.today.routine.name,
      date: new Date().toISOString().slice(0, 10),
      exerciseLogs,
      inProgress: false,
    };

    this.workoutService.saveSession(session).subscribe({
      next: (saved) => {
        this.workoutService.clearInProgressState();
        this.router.navigate(["/history/session", saved.id]);
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  private setsFor(exerciseId: string): CompletedSet[] {
    return (
      this.state?.workingSets.find((sets) => sets.exerciseId === exerciseId)
        ?.sets ?? []
    );
  }

  private updateElapsedTime(): void {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - (this.state?.startedAt ?? Date.now())) / 1000),
    );
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    this.elapsedTime = [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  }

  navigateToExercise(exerciseId: string) {
    if (this.state) {
      this.router.navigate([
        `/current-workout/${this.state.today.routine.id}/${exerciseId}`,
      ]);
    }
  }
}
