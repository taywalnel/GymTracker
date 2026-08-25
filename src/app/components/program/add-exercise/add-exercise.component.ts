import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  Exercise,
  ResolvedExercisePrescription,
  Routine,
} from "../../../models/workout.models";
import { UnitPreferenceService } from "../../../services/unit-preference.service";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { InputComponent } from "../../input/input.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { SelectComponent, SelectOption } from "../../select/select.component";
import { StepperComponent } from "../../stepper/stepper.component";
import { UnitToggleComponent } from "../../unit-toggle/unit-toggle.component";

@Component({
  selector: "app-add-exercise",
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    SelectComponent,
    StepperComponent,
    UnitToggleComponent,
  ],
  templateUrl: "./add-exercise.component.html",
  styleUrl: "./add-exercise.component.scss",
})
export class AddExerciseComponent implements OnInit {
  exerciseId = "";
  exercises: Exercise[] = [];
  isLoadingExercises = true;
  weightKg: number | null = null;
  sets = 1;
  reps = 1;
  restSeconds = 60;
  validationAttempted = false;

  get pageTitle(): string {
    return this.routeExerciseId === "new" ? "Add Exercise" : "Edit Exercise";
  }

  get isEditMode(): boolean {
    return this.routeExerciseId !== "new";
  }

  private get isActiveWorkoutAdjustment(): boolean {
    return this.returnUrl.startsWith("/current-workout/");
  }

  get exerciseOptions(): SelectOption[] {
    return this.exercises.map((exercise) => ({
      value: exercise.id,
      label: exercise.name,
    }));
  }

  get invalidRestSeconds(): boolean {
    return !Number.isInteger(this.restSeconds) || this.restSeconds < 0;
  }

  private routine: Routine | undefined;
  private readonly originalRoutine: Routine | undefined;
  existingExercise: ResolvedExercisePrescription | undefined;
  private readonly returnUrl: string;
  private routineId = "";
  private routeExerciseId = "";

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    private units: UnitPreferenceService,
  ) {
    const state =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.routine = state["routine"] as Routine | undefined;
    this.originalRoutine = state["originalRoutine"] as Routine | undefined;
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

    if (this.routeExerciseId === "new") {
      return;
    }

    this.existingExercise = routine.exercises.find(
      (exercise) => exercise.id === this.routeExerciseId,
    );
    if (!this.existingExercise) {
      this.router.navigateByUrl(
        this.returnUrl || `/program/workout/edit/${this.routineId}`,
      );
      return;
    }

    this.exerciseId = this.existingExercise.id;
    this.weightKg = this.existingExercise.targetWeightKg;
    this.sets = this.existingExercise.targetSets;
    this.reps = this.existingExercise.targetReps;
    this.restSeconds = this.existingExercise.restSeconds ?? 60;
  }

  get weight(): number | null {
    if (this.weightKg === null) {
      return null;
    }

    return Number(this.units.fromKg(this.weightKg).toFixed(1));
  }

  set weight(value: number | null) {
    if (value !== null && Number.isFinite(value) && value >= 0) {
      this.weightKg = this.units.toKg(value);
    } else if (value === null) {
      this.weightKg = null;
    }
  }

  save(): void {
    const selectedExercise = this.exercises.find(
      (exercise) => exercise.id === this.exerciseId,
    );
    this.validationAttempted = true;
    if (
      !selectedExercise ||
      this.weightKg === null ||
      this.sets < 1 ||
      this.reps < 1 ||
      this.invalidRestSeconds
    ) {
      return;
    }

    const exercise: ResolvedExercisePrescription = {
      id: selectedExercise.id,
      name: selectedExercise.name,
      targetWeightKg: this.weightKg,
      targetSets: this.sets,
      targetReps: this.reps,
      restSeconds: this.restSeconds,
      order:
        this.existingExercise?.order ?? this.routine?.exercises.length ?? 0,
    };

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
      return;
    }

    this.router.navigateByUrl(this.returnUrl, {
      state: {
        routine: this.routine,
        originalRoutine: this.originalRoutine,
        exercise,
        replaceExerciseId: this.existingExercise?.id,
      },
    });
  }

  delete(): void {
    if (!this.existingExercise) {
      return;
    }

    this.router.navigateByUrl(this.returnUrl, {
      state: {
        routine: this.routine,
        originalRoutine: this.originalRoutine,
        removeExerciseId: this.existingExercise.id,
      },
    });
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnUrl, {
      state: { routine: this.routine, originalRoutine: this.originalRoutine },
    });
  }
}
