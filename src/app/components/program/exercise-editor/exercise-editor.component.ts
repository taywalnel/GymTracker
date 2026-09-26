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
import {
  ChoiceListComponent,
  ChoiceOption,
} from "../../choice-list/choice-list.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";

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
  primaryMuscleGroup: MuscleGroup | "other" | null = null;
  readonly muscleGroupOptions: ChoiceOption<MuscleGroup | "other">[] = [
    ...MUSCLE_GROUPS.map((value) => ({
      value,
      label: MUSCLE_GROUP_LABELS[value],
    })),
    { value: "other", label: "Other" },
  ];
  exerciseId: string | null = null;
  saving = false;

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
        this.primaryMuscleGroup = exercise.primaryMuscleGroup ?? "other";
      },
    });
  }

  get isEditing(): boolean {
    return this.exerciseId !== null;
  }

  get canSave(): boolean {
    return !!this.name.trim() && this.primaryMuscleGroup !== null;
  }

  save(): void {
    const name = this.name.trim();
    const primaryMuscleGroup = this.primaryMuscleGroup;
    if (!name || !primaryMuscleGroup || this.saving) return;

    const exercise: Exercise = {
      id: this.exerciseId ?? this.workoutService.generateExerciseId(),
      name,
      ...(primaryMuscleGroup !== "other" ? { primaryMuscleGroup } : {}),
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
