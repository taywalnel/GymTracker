import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CompletedSet,
  ResolvedExercisePrescription,
} from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { ExerciseCardComponent } from "../exercise-card/exercise-card.component";

@Component({
  selector: "app-current-exercise-page",
  imports: [ExerciseCardComponent],
  templateUrl: "./current-exercise-page.component.html",
  styleUrl: "./current-exercise-page.component.scss",
})
export class CurrentExercisePageComponent implements OnInit {
  state: InProgressState | null = null;
  exercise: ResolvedExercisePrescription | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.loadExercise(params.get("workoutId"), params.get("exerciseId"));
    });
  }

  private loadExercise(
    workoutId: string | null,
    exerciseId: string | null,
  ): void {
    const state = this.workoutService.getInProgressState();
    if (!state || state.today.routine.id !== workoutId) {
      this.router.navigate(["/"]);
      return;
    }

    const exercise = state.today.routine.exercises.find(
      (item) => item.id === exerciseId,
    );
    if (!exercise) {
      this.router.navigate(["/current-workout", workoutId]);
      return;
    }

    this.state = { ...state, activeExerciseId: exercise.id };
    this.workoutService.saveInProgressState(this.state);
    this.exercise = exercise;
    this.isLoading = false;
  }

  onSetsChanged(sets: CompletedSet[]): void {
    if (!this.state || !this.exercise) return;
    const workingSets = this.state.workingSets.filter(
      (entry) => entry.exerciseId !== this.exercise!.id,
    );
    workingSets.push({ exerciseId: this.exercise.id, sets });
    this.saveState({ ...this.state, workingSets });
  }

  onMarkComplete(): void {
    if (!this.state || !this.exercise) return;
    const completedExerciseIds = Array.from(
      new Set([...this.state.completedExerciseIds, this.exercise.id]),
    );
    const nextExercise = this.nextIncompleteExercise(completedExerciseIds);
    this.saveState({
      ...this.state,
      completedExerciseIds,
      activeExerciseId: null,
    });

    if (nextExercise) {
      this.router.navigate([
        "/current-workout",
        this.state.today.routine.id,
        nextExercise.id,
      ]);
      return;
    }

    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  goToWorkout(): void {
    if (!this.state) return;
    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  adjustRoutine(): void {
    if (!this.state || !this.exercise) return;

    this.router.navigate(["/program/workout/edit/edit-exercise"], {
      state: {
        routine: this.state.today.routine,
        exercise: this.exercise,
        returnUrl: this.router.url,
      },
    });
  }

  onProgressionSuggestionShown(): void {
    if (!this.state || !this.exercise) return;
    const progressionSuggestedExerciseIds = Array.from(
      new Set([
        ...(this.state.progressionSuggestedExerciseIds ?? []),
        this.exercise.id,
      ]),
    );
    this.saveState({ ...this.state, progressionSuggestedExerciseIds });
  }

  goToNextExercise(): void {
    if (!this.state || !this.exercise) return;

    const exercises = this.state.today.routine.exercises;
    const currentIndex = exercises.findIndex(
      (item) => item.id === this.exercise!.id,
    );
    const nextExercise = exercises[currentIndex + 1];

    if (nextExercise) {
      this.router.navigate([
        "/current-workout",
        this.state.today.routine.id,
        nextExercise.id,
      ]);
      return;
    }

    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  get savedSets(): CompletedSet[] | null {
    if (!this.state || !this.exercise) return null;
    return (
      this.state.workingSets.find(
        (entry) => entry.exerciseId === this.exercise!.id,
      )?.sets ?? null
    );
  }

  get progressionSuggestionAlreadyShown(): boolean {
    return (
      this.state?.progressionSuggestedExerciseIds?.includes(
        this.exercise?.id ?? "",
      ) ?? false
    );
  }

  private saveState(state: InProgressState): void {
    this.state = state;
    this.workoutService.saveInProgressState(state);
  }

  private nextIncompleteExercise(
    completedExerciseIds: string[],
  ): ResolvedExercisePrescription | undefined {
    if (!this.state || !this.exercise) return undefined;

    const exercises = this.state.today.routine.exercises
      .slice()
      .sort((left, right) => left.order - right.order);
    const currentIndex = exercises.findIndex(
      (item) => item.id === this.exercise!.id,
    );
    const isIncomplete = (item: ResolvedExercisePrescription) =>
      !completedExerciseIds.includes(item.id);

    return (
      exercises.slice(currentIndex + 1).find(isIncomplete) ??
      exercises.find(isIncomplete)
    );
  }
}
