import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  ExerciseCategory,
  exerciseCategory,
  Routine,
  WorkoutSession,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { formatDaysAgo } from "../../../utils/dates";
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
    key: ExerciseCategory;
    label: string;
    exercises: Exercise[];
  }[] = [];
  loading = false;
  // Secondary line per exercise id: which routines use it, when it was last done.
  exerciseDetails = new Map<string, string>();

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
      routines: this.workoutService.getAllRoutines(),
      sessions: this.workoutService.getSessionHistory(),
    }).subscribe({
      next: ({ exercises, routines, sessions }) => {
        this.exercises = [...exercises];
        this.exerciseGroups = this.buildGroups(this.exercises);
        this.exerciseDetails = this.buildDetails(
          this.exercises,
          routines,
          sessions,
        );
        this.loading = false;
      },
    });
  }

  private buildDetails(
    exercises: Exercise[],
    routines: Routine[],
    sessions: WorkoutSession[],
  ): Map<string, string> {
    const lastDone = new Map<string, string>();
    for (const session of sessions) {
      if (session.inProgress) continue;
      for (const log of session.exerciseLogs) {
        if (!log.completedSets.length) continue;
        const previous = lastDone.get(log.exerciseId);
        if (!previous || session.date > previous) {
          lastDone.set(log.exerciseId, session.date);
        }
      }
    }

    const sortedRoutines = [...routines].sort(
      (first, second) => first.rotationOrder - second.rotationOrder,
    );
    return new Map(
      exercises.map((exercise) => {
        const routineNames = sortedRoutines
          .filter((routine) =>
            routine.exercises.some(({ id }) => id === exercise.id),
          )
          .map(({ name }) => name);
        const usage =
          routineNames.length === 0
            ? "Not in any routine"
            : routineNames.length <= 2
              ? routineNames.join(", ")
              : `In ${routineNames.length} routines`;

        const date = lastDone.get(exercise.id);
        if (!date) return [exercise.id, usage];
        const ago = formatDaysAgo(date);
        const done = ago === "Today" ? "Done today" : `Last done ${ago}`;
        return [exercise.id, `${usage} · ${done}`];
      }),
    );
  }

  private buildGroups(exercises: Exercise[]): typeof this.exerciseGroups {
    return EXERCISE_CATEGORIES.map((key) => ({
      key,
      label: EXERCISE_CATEGORY_LABELS[key],
      exercises: exercises
        .filter((exercise) => exerciseCategory(exercise) === key)
        .sort((first, second) => first.name.localeCompare(second.name)),
    })).filter((group) => group.exercises.length > 0);
  }

  createExercise(): void {
    this.router.navigate(["/program/exercises/new"]);
  }

  viewExercise(exercise: Exercise): void {
    this.router.navigate(["/history/exercises", exercise.id]);
  }
}
