import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { ExercisePrescription, Routine } from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { WorkoutService } from "../../services/workout.service";
import { ButtonComponent } from "../button/button.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { StepperComponent } from "../stepper/stepper.component";
import { UnitToggleComponent } from "../unit-toggle/unit-toggle.component";

@Component({
  selector: "app-add-exercise",
  imports: [
    FormsModule,
    ButtonComponent,
    PageHeaderComponent,
    StepperComponent,
    UnitToggleComponent,
  ],
  templateUrl: "./add-exercise.component.html",
  styleUrl: "./add-exercise.component.scss",
})
export class AddExerciseComponent {
  title = "";
  weightKg: number | null = null;
  sets = 1;
  reps = 1;
  validationAttempted = false;

  private readonly routine: Routine | undefined;
  private readonly existingExercise: ExercisePrescription | undefined;
  private readonly returnUrl: string;

  constructor(
    private router: Router,
    private workoutService: WorkoutService,
    private units: UnitPreferenceService,
  ) {
    const state =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.routine = state["routine"] as Routine | undefined;
    this.existingExercise = state["exercise"] as
      | ExercisePrescription
      | undefined;
    this.returnUrl =
      (state["returnUrl"] as string | undefined) ?? "/program/edit";

    if (this.existingExercise) {
      this.title = this.existingExercise.name;
      this.weightKg = this.existingExercise.targetWeightKg;
      this.sets = this.existingExercise.targetSets;
      this.reps = this.existingExercise.targetReps;
    }
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
    const name = this.title.trim();
    this.validationAttempted = true;
    if (!name || this.weightKg === null || this.sets < 1 || this.reps < 1) {
      return;
    }

    const exercise: ExercisePrescription = {
      id: this.existingExercise?.id ?? this.workoutService.generateExerciseId(),
      name,
      targetWeightKg: this.weightKg,
      targetSets: this.sets,
      targetReps: this.reps,
      order:
        this.existingExercise?.order ?? this.routine?.exercises.length ?? 0,
    };

    this.router.navigateByUrl(this.returnUrl, {
      state: {
        routine: this.routine,
        exercise,
        replaceExerciseId: this.existingExercise?.id,
      },
    });
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnUrl, {
      state: { routine: this.routine },
    });
  }
}
