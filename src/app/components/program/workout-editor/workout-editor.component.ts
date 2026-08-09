import { Component, OnInit } from "@angular/core";

import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { WorkoutService } from "../../../services/workout.service";
import {
  Routine,
  ResolvedExercisePrescription,
} from "../../../models/workout.models";
import { UnitPreferenceService } from "../../../services/unit-preference.service";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { EditableCardComponent } from "../../editable-card/editable-card.component";
import { InputComponent } from "../../input/input.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";

@Component({
  selector: "app-workout-editor",
  imports: [
    FormsModule,
    ButtonComponent,
    ConfirmationModalComponent,
    EditableCardComponent,
    InputComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
  ],
  templateUrl: "./workout-editor.component.html",
  styleUrl: "./workout-editor.component.scss",
})
export class WorkoutEditorComponent implements OnInit {
  routineId: string | null = null;
  routine: Routine = {
    id: "",
    name: "",
    rotationOrder: 0,
    exercises: [],
  };
  private originalRoutine: Routine = this.cloneRoutine(this.routine);
  loading = false;
  saving = false;
  showDiscardConfirmation = false;
  validationErrors = {
    name: false,
    exercises: false,
  };

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    readonly unitPref: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    this.routineId = this.route.snapshot.paramMap.get("id");
    const state = history.state as {
      routine?: Routine;
      originalRoutine?: Routine;
      exercise?: ResolvedExercisePrescription;
      replaceExerciseId?: string;
      removeExerciseId?: string;
    };

    if (state.routine) {
      this.routine = this.cloneRoutine(state.routine);
      this.originalRoutine = this.cloneRoutine(
        state.originalRoutine ?? state.routine,
      );
      if (state.removeExerciseId) {
        this.routine.exercises = this.routine.exercises.filter(
          (exercise) => exercise.id !== state.removeExerciseId,
        );
      } else if (state.exercise) {
        this.routine.exercises = state.replaceExerciseId
          ? this.routine.exercises.map((exercise) =>
              exercise.id === state.replaceExerciseId
                ? state.exercise!
                : exercise,
            )
          : [...this.routine.exercises, state.exercise];
      }
      return;
    }

    if (this.routineId) {
      this.loadRoutine();
    } else {
      // New routine - initialize with empty state
      this.routine.id = this.workoutService.generateRoutineId();
      this.originalRoutine = this.cloneRoutine(this.routine);
    }
  }

  get hasUnsavedChanges(): boolean {
    return (
      JSON.stringify(this.routine) !== JSON.stringify(this.originalRoutine)
    );
  }

  loadRoutine(): void {
    if (!this.routineId) return;
    this.loading = true;
    this.workoutService.getRoutineById(this.routineId).subscribe({
      next: (routine) => {
        if (routine) {
          this.routine = this.cloneRoutine(routine);
          this.originalRoutine = this.cloneRoutine(this.routine);
        }
        this.loading = false;
      },
    });
  }

  addExercise(): void {
    this.router.navigate(
      ["/program/workout/edit", this.routine.id, "exercise", "new"],
      {
        state: {
          routine: this.routine,
          originalRoutine: this.originalRoutine,
          returnUrl: this.router.url,
        },
      },
    );
  }

  editExercise(exercise: ResolvedExercisePrescription): void {
    this.router.navigate(
      ["/program/workout/edit", this.routine.id, "exercise", exercise.id],
      {
        state: {
          routine: this.routine,
          originalRoutine: this.originalRoutine,
          exercise,
          returnUrl: this.router.url,
        },
      },
    );
  }

  deleteExercise(exerciseId: string): void {
    this.routine.exercises = this.routine.exercises.filter(
      (exercise) => exercise.id !== exerciseId,
    );
  }

  requestBack(): void {
    if (this.hasUnsavedChanges) {
      this.showDiscardConfirmation = true;
      return;
    }

    this.navigateBack();
  }

  cancelDiscard(): void {
    this.showDiscardConfirmation = false;
  }

  discardChanges(): void {
    this.routine = this.cloneRoutine(this.originalRoutine);
    this.showDiscardConfirmation = false;
    this.validationErrors = {
      name: false,
      exercises: false,
    };
  }

  discardChangesAndNavigate(): void {
    this.discardChanges();
    this.navigateBack();
  }

  save(): void {
    this.validationErrors = {
      name: !this.routine.name.trim(),
      exercises: this.routine.exercises.length === 0,
    };

    if (this.validationErrors.name || this.validationErrors.exercises) {
      return;
    }

    this.saving = true;
    this.workoutService.saveRoutine(this.routine).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(["/program"]);
      },
      error: () => {
        this.saving = false;
        alert("Error saving routine");
      },
    });
  }

  clearNameError(): void {
    this.validationErrors.name = false;
  }

  cancel(): void {
    this.router.navigate(["/program"]);
  }

  private navigateBack(): void {
    this.showDiscardConfirmation = false;
    this.router.navigate(["/program"]);
  }

  private cloneRoutine(routine: Routine): Routine {
    return JSON.parse(JSON.stringify(routine)) as Routine;
  }

  exerciseDescription(exercise: ResolvedExercisePrescription): string {
    return `${exercise.targetSets} sets of ${exercise.targetReps} reps - ${this.unitPref.formatWeight(exercise.targetWeightKg)}${this.unitPref.unitLabel()}`;
  }
}
