import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
  Exercise,
  ResolvedExercisePrescription,
  Routine,
} from "../../../models/workout.models";
import { UnitPreferenceService } from "../../../services/unit-preference.service";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { InputComponent } from "../../input/input.component";
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
  validationAttempted = false;

  get pageTitle(): string {
    return this.router.url.endsWith("/edit-exercise")
      ? "Edit Exercise"
      : "Add Exercise";
  }

  get exerciseOptions(): SelectOption[] {
    return this.exercises.map((exercise) => ({
      value: exercise.id,
      label: exercise.name,
    }));
  }

  private readonly routine: Routine | undefined;
  private readonly originalRoutine: Routine | undefined;
  readonly existingExercise: ResolvedExercisePrescription | undefined;
  private readonly returnUrl: string;

  constructor(
    private router: Router,
    private workoutService: WorkoutService,
    private units: UnitPreferenceService,
  ) {
    const state =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.routine = state["routine"] as Routine | undefined;
    this.originalRoutine = state["originalRoutine"] as Routine | undefined;
    this.existingExercise = state["exercise"] as
      | ResolvedExercisePrescription
      | undefined;
    this.returnUrl =
      (state["returnUrl"] as string | undefined) ?? "/program/workout/edit";

    if (this.existingExercise) {
      this.exerciseId = this.existingExercise.id;
      this.weightKg = this.existingExercise.targetWeightKg;
      this.sets = this.existingExercise.targetSets;
      this.reps = this.existingExercise.targetReps;
    }
  }

  ngOnInit(): void {
    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = [...exercises].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
        this.isLoadingExercises = false;
      },
      error: () => {
        this.isLoadingExercises = false;
      },
    });
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
      this.reps < 1
    ) {
      return;
    }

    const exercise: ResolvedExercisePrescription = {
      id: selectedExercise.id,
      name: selectedExercise.name,
      targetWeightKg: this.weightKg,
      targetSets: this.sets,
      targetReps: this.reps,
      order:
        this.existingExercise?.order ?? this.routine?.exercises.length ?? 0,
    };

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
