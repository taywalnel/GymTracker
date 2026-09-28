import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  Exercise,
  ResolvedExercisePrescription,
  Routine,
  targetRepsFields,
  targetRepsPerSet,
  targetWeightFields,
  targetWeightsKg,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { StepperComponent } from "../../stepper/stepper.component";
import {
  SetTargets,
  SetTargetsComponent,
} from "../set-targets/set-targets.component";

@Component({
  selector: "app-edit-exercise",
  imports: [
    FormsModule,
    ButtonComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    StepperComponent,
    SetTargetsComponent,
  ],
  templateUrl: "./edit-exercise.component.html",
  styleUrl: "./edit-exercise.component.scss",
})
export class EditExerciseComponent implements OnInit {
  exerciseId = "";
  exercises: Exercise[] = [];
  isLoadingExercises = true;
  /** Target weight (kg) and reps for each set. */
  targets: SetTargets = { weightsKg: [0], reps: [1] };
  restSeconds = 60;
  validationAttempted = false;

  get pageTitle(): string {
    return "Edit Exercise";
  }

  get invalidRestSeconds(): boolean {
    return !Number.isInteger(this.restSeconds) || this.restSeconds < 0;
  }

  private routine: Routine | undefined;
  existingExercise: ResolvedExercisePrescription | undefined;
  private readonly returnUrl: string;
  private routineId = "";
  private routeExerciseId = "";
  // True when editing the unsaved routine on the New Routine screen.
  private isDraft = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
  ) {
    const state =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.routine = state["routine"] as Routine | undefined;
    this.returnUrl = (state["returnUrl"] as string | undefined) ?? "";
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.routineId = params.get("id") ?? "";
    this.routeExerciseId = params.get("exerciseId") ?? "";

    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = [...exercises].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
        this.isLoadingExercises = false;
        this.loadRoutine();
      },
      error: () => {
        this.isLoadingExercises = false;
      },
    });
  }

  private loadRoutine(): void {
    if (!this.routineId) {
      this.router.navigateByUrl("/program");
      return;
    }

    const draft = this.workoutService.getRoutineDraft();
    if (draft?.id === this.routineId) {
      this.isDraft = true;
      this.initializeFromRoutine(draft);
      return;
    }

    const stateRoutine = this.routine;
    if (stateRoutine?.id === this.routineId) {
      this.initializeFromRoutine(stateRoutine);
      return;
    }

    this.workoutService.getRoutineById(this.routineId).subscribe({
      next: (routine) => {
        if (!routine) {
          this.router.navigateByUrl("/program");
          return;
        }
        this.initializeFromRoutine(routine);
      },
      error: () => this.router.navigateByUrl("/program"),
    });
  }

  private initializeFromRoutine(routine: Routine): void {
    this.routine = routine;
    this.existingExercise = routine.exercises.find(
      (exercise) => exercise.id === this.routeExerciseId,
    );
    if (!this.existingExercise) {
      this.router.navigateByUrl(this.returnDestination);
      return;
    }

    this.exerciseId = this.existingExercise.id;
    this.targets = {
      weightsKg: targetWeightsKg(this.existingExercise),
      reps: targetRepsPerSet(this.existingExercise),
    };
    this.restSeconds = this.existingExercise.restSeconds ?? 60;
  }


  save(): void {
    const selectedExercise = this.exercises.find(
      (exercise) => exercise.id === this.exerciseId,
    );
    this.validationAttempted = true;
    if (
      !selectedExercise ||
      this.targets.reps.length < 1 ||
      this.targets.reps.some((reps) => reps < 1) ||
      this.invalidRestSeconds
    ) {
      return;
    }

    const exercise: ResolvedExercisePrescription = {
      id: selectedExercise.id,
      name: selectedExercise.name,
      ...targetWeightFields(this.targets.weightsKg),
      ...targetRepsFields(this.targets.reps),
      targetSets: this.targets.reps.length,
      restSeconds: this.restSeconds,
      order: this.existingExercise?.order ?? 0,
    };

    if (!this.isActiveWorkoutAdjustment && this.routine) {
      const updatedRoutine: Routine = {
        ...this.routine,
        exercises: this.routine.exercises.map((routineExercise) =>
          routineExercise.id === this.existingExercise?.id
            ? exercise
            : routineExercise,
        ),
      };
      if (this.isDraft) {
        this.workoutService.saveRoutineDraft(updatedRoutine);
        this.router.navigateByUrl(this.returnDestination);
        return;
      }
      this.workoutService.saveRoutine(updatedRoutine).subscribe({
        next: () => this.router.navigateByUrl(this.returnDestination),
        error: () => alert("Error saving routine"),
      });
      return;
    }

    if (this.isActiveWorkoutAdjustment && this.routine) {
      const updatedRoutine: Routine = {
        ...this.routine,
        exercises: this.routine.exercises.map((routineExercise) =>
          routineExercise.id === this.existingExercise?.id
            ? exercise
            : routineExercise,
        ),
      };
      const inProgressState = this.workoutService.getInProgressState();

      this.workoutService.saveRoutine(updatedRoutine).subscribe({
        next: () => {
          if (inProgressState) {
            const previousExerciseId = this.existingExercise?.id;
            const workingSets = inProgressState.workingSets.map((entry) =>
              entry.exerciseId === previousExerciseId
                ? { ...entry, exerciseId: exercise.id }
                : entry,
            );
            const completedExerciseIds =
              inProgressState.completedExerciseIds.map((id) =>
                id === previousExerciseId ? exercise.id : id,
              );
            const progressionSuggestedExerciseIds =
              inProgressState.progressionSuggestedExerciseIds?.map((id) =>
                id === previousExerciseId ? exercise.id : id,
              );

            this.workoutService.saveInProgressState({
              ...inProgressState,
              today: { ...inProgressState.today, routine: updatedRoutine },
              activeExerciseId:
                inProgressState.activeExerciseId === previousExerciseId
                  ? exercise.id
                  : inProgressState.activeExerciseId,
              workingSets,
              completedExerciseIds,
              progressionSuggestedExerciseIds,
            });
          }

          const adjustedReturnUrl = this.existingExercise?.id
            ? this.returnUrl.replace(
                `/${this.existingExercise.id}`,
                `/${exercise.id}`,
              )
            : this.returnUrl;
          this.router.navigateByUrl(adjustedReturnUrl);
        },
        error: () => alert("Error saving routine"),
      });
    }
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnDestination);
  }

  private get isActiveWorkoutAdjustment(): boolean {
    return this.returnUrl.startsWith("/current-workout/");
  }

  private get returnDestination(): string {
    if (this.returnUrl) return this.returnUrl;
    return this.isDraft
      ? "/program/workout/new"
      : `/program/workout/${this.routineId}`;
  }
}
