import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import {
  Exercise,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  MuscleGroup,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { EditableCardComponent } from "../../editable-card/editable-card.component";
import { EmptyStateComponent } from "../../empty-state/empty-state.component";

@Component({
  selector: "app-exercises-list",
  imports: [ButtonComponent, EditableCardComponent, EmptyStateComponent],
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
  loading = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.loading = true;
    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = [...exercises];
        this.exerciseGroups = this.buildGroups(this.exercises);
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
}
