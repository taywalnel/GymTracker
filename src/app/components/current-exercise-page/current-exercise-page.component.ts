import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CompletedSet,
  ExercisePrescription,
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
  exercise: ExercisePrescription | null = null;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    const workoutId = this.route.snapshot.paramMap.get("workoutId");
    const exerciseId = this.route.snapshot.paramMap.get("exerciseId");
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
    this.saveState({
      ...this.state,
      completedExerciseIds,
      activeExerciseId: null,
    });
    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  goToWorkout(): void {
    if (!this.state) return;
    this.router.navigate(["/current-workout", this.state.today.routine.id]);
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

  private saveState(state: InProgressState): void {
    this.state = state;
    this.workoutService.saveInProgressState(state);
  }
}
