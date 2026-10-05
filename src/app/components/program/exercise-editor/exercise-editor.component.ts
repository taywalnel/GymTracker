import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  ExerciseCategory,
  findExerciseByName,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import {
  ChoiceListComponent,
  ChoiceOption,
} from "../../choice-list/choice-list.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { NavigationHistoryService } from "../../../services/navigation-history.service";

// Creates a catalog exercise. Existing ones are edited on the exercise's
// Manage tab (ExerciseHistoryPageComponent).
@Component({
  selector: "app-exercise-editor",
  imports: [
    FormsModule,
    ButtonComponent,
    ChoiceListComponent,
    InputComponent,
    PageHeaderComponent,
  ],
  templateUrl: "./exercise-editor.component.html",
  styleUrl: "./exercise-editor.component.scss",
})
export class ExerciseEditorComponent implements OnInit {
  name = "";
  // "other" means the exercise has no primary muscle group.
  primaryMuscleGroup: ExerciseCategory | null = null;
  readonly muscleGroupOptions: ChoiceOption<ExerciseCategory>[] =
    EXERCISE_CATEGORIES.map((value) => ({
      value,
      label: EXERCISE_CATEGORY_LABELS[value],
    }));
  saving = false;
  private exercises: Exercise[] = [];

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
    private navigationHistory: NavigationHistoryService,
  ) {}

  ngOnInit(): void {
    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => (this.exercises = exercises),
    });
  }

  get duplicateError(): string | null {
    const duplicate = findExerciseByName(this.exercises, this.name);
    return duplicate
      ? `You already have an exercise called ${duplicate.name}.`
      : null;
  }

  get canSave(): boolean {
    return (
      !!this.name.trim() &&
      this.primaryMuscleGroup !== null &&
      !this.duplicateError
    );
  }

  save(): void {
    const name = this.name.trim();
    const primaryMuscleGroup = this.primaryMuscleGroup;
    if (!this.canSave || !primaryMuscleGroup || this.saving) return;

    const exercise: Exercise = {
      id: this.workoutService.generateExerciseId(),
      name,
      ...(primaryMuscleGroup !== "other" ? { primaryMuscleGroup } : {}),
    };
    this.saving = true;
    this.workoutService.saveExercise(exercise).subscribe({
      next: () => this.navigationHistory.back("/program?tab=Exercises"),
      error: () => {
        this.saving = false;
        alert("Error saving exercise");
      },
    });
  }

  cancel(): void {
    this.navigationHistory.back("/program?tab=Exercises");
  }
}
