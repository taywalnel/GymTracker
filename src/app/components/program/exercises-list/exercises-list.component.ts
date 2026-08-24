import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  Exercise,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  MuscleGroup,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { EditableCardComponent } from "../../editable-card/editable-card.component";

@Component({
  selector: "app-exercises-list",
  imports: [ButtonComponent, ConfirmationModalComponent, EditableCardComponent],
  templateUrl: "./exercises-list.component.html",
  styleUrl: "./exercises-list.component.scss",
})
export class ExercisesListComponent implements OnInit {
  exercises: Exercise[] = [];
  exerciseGroups: {
    key: MuscleGroup | "uncategorized";
    label: string;
    exercises: Exercise[];
  }[] = [];
  exerciseUsageCounts: Record<string, number> = {};
  loading = false;
  pendingDeleteExercise: Exercise | null = null;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.loading = true;
    forkJoin({
      exercises: this.workoutService.getAllExercises(),
      usageCounts: this.workoutService.getExerciseUsageCounts(),
    }).subscribe({
      next: ({ exercises, usageCounts }) => {
        this.exercises = [...exercises];
        this.exerciseGroups = this.buildGroups(this.exercises);
        this.exerciseUsageCounts = usageCounts;
        this.loading = false;
      },
    });
  }

  private buildGroups(exercises: Exercise[]): typeof this.exerciseGroups {
    const groups: typeof this.exerciseGroups = MUSCLE_GROUPS.map((key) => ({
      key,
      label: MUSCLE_GROUP_LABELS[key],
      exercises: exercises
        .filter((exercise) => exercise.primaryMuscleGroup === key)
        .sort((first, second) => first.name.localeCompare(second.name)),
    })).filter((group) => group.exercises.length > 0);

    const uncategorized = exercises
      .filter(
        (exercise) =>
          !exercise.primaryMuscleGroup ||
          !MUSCLE_GROUPS.includes(exercise.primaryMuscleGroup),
      )
      .sort((first, second) => first.name.localeCompare(second.name));

    if (uncategorized.length > 0) {
      groups.push({
        key: "uncategorized",
        label: "Uncategorized",
        exercises: uncategorized,
      });
    }

    return groups;
  }

  createExercise(): void {
    this.router.navigate(["/program/exercises/new"]);
  }

  viewExercise(exercise: Exercise): void {
    this.router.navigate(["/history/exercises", exercise.id]);
  }

  editExercise(exercise: Exercise): void {
    this.router.navigate(["/program/exercises/edit", exercise.id]);
  }

  exerciseUsageDescription(exercise: Exercise): string {
    const count = this.exerciseUsageCounts[exercise.id] ?? 0;
    if (count === 0) return "Not yet performed";
    if (count === 1) return "Performed once";
    return `Performed ${count} times`;
  }

  deleteExercise(exercise: Exercise): void {
    this.pendingDeleteExercise = exercise;
  }

  cancelDelete(): void {
    this.pendingDeleteExercise = null;
  }

  confirmDelete(): void {
    const exercise = this.pendingDeleteExercise;
    if (!exercise) return;

    this.loading = true;
    this.workoutService.deleteExercise(exercise.id).subscribe({
      next: () => {
        this.exercises = this.exercises.filter(
          (item) => item.id !== exercise.id,
        );
        this.exerciseGroups = this.buildGroups(this.exercises);
        this.pendingDeleteExercise = null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
