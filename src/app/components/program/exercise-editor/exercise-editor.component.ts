import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  Exercise,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  MuscleGroup,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { CheckboxListComponent } from "../../checkbox-list/checkbox-list.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { SelectComponent } from "../../select/select.component";

@Component({
  selector: "app-exercise-editor",
  imports: [
    FormsModule,
    ButtonComponent,
    CheckboxListComponent,
    InputComponent,
    PageHeaderComponent,
    SelectComponent,
  ],
  templateUrl: "./exercise-editor.component.html",
  styleUrl: "./exercise-editor.component.scss",
})
export class ExerciseEditorComponent implements OnInit {
  name = "";
  primaryMuscleGroup: MuscleGroup | "" = "";
  secondaryMuscleGroups: MuscleGroup[] = [];
  readonly muscleGroupOptions = MUSCLE_GROUPS.map((value) => ({
    value,
    label: MUSCLE_GROUP_LABELS[value],
  }));
  exerciseId: string | null = null;
  saving = false;
  validationAttempted = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.exerciseId = this.route.snapshot.paramMap.get("id");
    if (!this.exerciseId) return;

    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        const exercise = exercises.find((item) => item.id === this.exerciseId);
        if (!exercise) {
          this.router.navigate(["/program/exercises"]);
          return;
        }
        this.name = exercise.name;
        this.primaryMuscleGroup = exercise.primaryMuscleGroup ?? "";
        this.secondaryMuscleGroups = [
          ...(exercise.secondaryMuscleGroups ?? []),
        ];
      },
    });
  }

  get isEditing(): boolean {
    return this.exerciseId !== null;
  }

  save(): void {
    this.validationAttempted = true;
    const name = this.name.trim();
    if (!name || this.saving) return;

    const exercise: Exercise = {
      id: this.exerciseId ?? this.workoutService.generateExerciseId(),
      name,
      ...(this.primaryMuscleGroup
        ? { primaryMuscleGroup: this.primaryMuscleGroup }
        : {}),
      ...(this.secondaryMuscleGroups.filter(
        (group) => group !== this.primaryMuscleGroup,
      ).length > 0
        ? {
            secondaryMuscleGroups: this.secondaryMuscleGroups.filter(
              (group) => group !== this.primaryMuscleGroup,
            ),
          }
        : {}),
    };
    this.saving = true;
    this.workoutService.saveExercise(exercise).subscribe({
      next: () => this.router.navigate(["/program"]),
      error: () => {
        this.saving = false;
        alert("Error saving exercise");
      },
    });
  }

  cancel(): void {
    this.router.navigate(["/program"]);
  }
}
