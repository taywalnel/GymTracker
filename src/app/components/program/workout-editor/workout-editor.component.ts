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
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";

@Component({
  selector: "app-workout-editor",
  imports: [
    FormsModule,
    ButtonComponent,
    InputComponent,
    PageHeaderComponent,
    RoutineCardComponent,
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
  loading = false;
  saving = false;
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
      exercise?: ResolvedExercisePrescription;
      replaceExerciseId?: string;
    };

    if (state.routine) {
      this.routine = state.routine;
      if (state.exercise) {
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
    }
  }

  loadRoutine(): void {
    if (!this.routineId) return;
    this.loading = true;
    this.workoutService.getRoutineById(this.routineId).subscribe({
      next: (routine) => {
        if (routine) {
          this.routine = JSON.parse(JSON.stringify(routine)); // Deep copy
        }
        this.loading = false;
      },
    });
  }

  addExercise(): void {
    this.router.navigate(["/program/workout/edit/add-exercise"], {
      state: { routine: this.routine, returnUrl: this.router.url },
    });
  }

  editExercise(exercise: ResolvedExercisePrescription): void {
    this.router.navigate(["/program/workout/edit/edit-exercise"], {
      state: {
        routine: this.routine,
        exercise,
        returnUrl: this.router.url,
      },
    });
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

  exerciseDescription(exercise: ResolvedExercisePrescription): string {
    return `${exercise.targetSets} x ${exercise.targetReps} reps - ${this.unitPref.formatWeight(exercise.targetWeightKg)}`;
  }
}
