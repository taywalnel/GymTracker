import { DatePipe } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  ExerciseLog,
  ResolvedExercisePrescription,
  Routine,
  WorkoutSession,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { formatDaysAgo } from "../../../utils/dates";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../../page-header/page-header.component";
import { ReorderableCardListComponent } from "../../reorderable-card-list/reorderable-card-list.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";
import { EmptyStateComponent } from "../../empty-state/empty-state.component";

@Component({
  selector: "app-workout-detail",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    DatePipe,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    ReorderableCardListComponent,
    RouterLink,
    RoutineCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./workout-detail.component.html",
  styleUrl: "./workout-detail.component.scss",
})
export class WorkoutDetailComponent implements OnInit {
  activeTab = "Exercises";
  routine: Routine | null = null;
  sessions: WorkoutSession[] = [];
  isLoading = true;
  isDeleting = false;
  isReordering = false;
  showDeleteConfirmation = false;
  exerciseToDelete: ResolvedExercisePrescription | null = null;
  private savedRoutine: Routine | null = null;
  private pendingRoutine: Routine | null = null;

  get detailTabs(): PageHeaderTab[] {
    return [
      { label: "Exercises", count: this.routine?.exercises.length ?? 0 },
      { label: "History", count: this.sessions.length },
    ];
  }

  get lastCompletedSession(): WorkoutSession | null {
    return this.sessions[0] ?? null;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    const routineId = this.route.snapshot.paramMap.get("id");
    if (!routineId) {
      this.isLoading = false;
      return;
    }

    forkJoin({
      routine: this.workoutService.getRoutineById(routineId),
      sessions: this.workoutService.getSessionHistory(),
    }).subscribe({
      next: ({ routine, sessions }) => {
        this.routine = routine;
        this.savedRoutine = routine;
        this.sessions = sessions
          .filter(
            (session) => session.routineId === routineId && !session.inProgress,
          )
          .sort((first, second) => second.date.localeCompare(first.date));
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  deleteRoutine(): void {
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDelete(): void {
    if (!this.routine || this.isDeleting) return;

    this.isDeleting = true;
    this.workoutService.deleteRoutine(this.routine.id).subscribe({
      next: () => this.router.navigate(["/program"]),
      error: () => {
        this.isDeleting = false;
        this.showDeleteConfirmation = false;
      },
    });
  }

  goBack(): void {
    this.router.navigate(["/program"]);
  }

  addExercise(): void {
    if (!this.routine) return;
    this.router.navigate(
      ["/program/workout/edit", this.routine.id, "add-exercise"],
      { state: { returnUrl: `/program/workout/${this.routine.id}` } },
    );
  }

  editExercise(exerciseId: string): void {
    if (!this.routine) return;
    this.router.navigate(
      ["/program/workout/edit", this.routine.id, "exercise", exerciseId],
      { state: { returnUrl: `/program/workout/${this.routine.id}` } },
    );
  }

  reorderExercises(exercises: ResolvedExercisePrescription[]): void {
    this.updateExercises(exercises);
  }

  requestDeleteExercise(exerciseId: string): void {
    this.exerciseToDelete =
      this.routine?.exercises.find((exercise) => exercise.id === exerciseId) ??
      null;
  }

  cancelDeleteExercise(): void {
    this.exerciseToDelete = null;
  }

  confirmDeleteExercise(): void {
    if (!this.routine || !this.exerciseToDelete) return;

    const exerciseId = this.exerciseToDelete.id;
    this.exerciseToDelete = null;
    this.updateExercises(
      this.routine.exercises.filter((exercise) => exercise.id !== exerciseId),
    );
  }

  private updateExercises(exercises: ResolvedExercisePrescription[]): void {
    if (!this.routine) return;

    this.routine = {
      ...this.routine,
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        order: index,
      })),
    };
    this.pendingRoutine = this.routine;

    if (!this.isReordering) this.savePendingRoutine();
  }

  // Saves run one at a time so a slower earlier write can't overwrite a newer
  // list. Changes made mid-save collapse into a single follow-up save.
  private savePendingRoutine(): void {
    const routine = this.pendingRoutine;
    this.pendingRoutine = null;
    if (!routine) {
      this.isReordering = false;
      return;
    }

    this.isReordering = true;
    this.workoutService.saveRoutine(routine).subscribe({
      next: () => {
        this.savedRoutine = routine;
        this.savePendingRoutine();
      },
      error: () => {
        if (this.pendingRoutine) {
          this.savePendingRoutine();
          return;
        }
        this.routine = this.savedRoutine;
        this.isReordering = false;
      },
    });
  }

  readonly formatDaysAgo = formatDaysAgo;

  getExerciseDotClass(log: ExerciseLog): string {
    if (log.targetReps === undefined) return "status-dot";
    if (!log.completedSets.length) return "status-dot danger";

    const averageReps =
      log.completedSets.reduce((total, set) => total + set.reps, 0) /
      log.completedSets.length;

    if (averageReps >= log.targetReps) return "status-dot success";
    if (log.targetReps - averageReps <= 2) return "status-dot warn";
    return "status-dot danger";
  }
}
