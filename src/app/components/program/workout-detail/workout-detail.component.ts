import { DatePipe } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  ExerciseLog,
  Routine,
  WorkoutSession,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../../page-header/page-header.component";

@Component({
  selector: "app-workout-detail",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    DatePipe,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RouterLink,
  ],
  templateUrl: "./workout-detail.component.html",
  styleUrl: "./workout-detail.component.scss",
})
export class WorkoutDetailComponent implements OnInit {
  activeTab = "Overview";
  routine: Routine | null = null;
  sessions: WorkoutSession[] = [];
  isLoading = true;
  isDeleting = false;
  showDeleteConfirmation = false;

  get detailTabs(): PageHeaderTab[] {
    return [
      { label: "Overview" },
      { label: "Manage" },
      { label: "History", count: this.sessions.length },
    ];
  }

  get lastCompletedSession(): WorkoutSession | null {
    return this.sessions[0] ?? null;
  }

  get totalSets(): number {
    return (
      this.routine?.exercises.reduce(
        (total, exercise) => total + exercise.targetSets,
        0,
      ) ?? 0
    );
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

  editRoutine(): void {
    if (!this.routine) return;
    this.router.navigate(["/program/workout/edit", this.routine.id]);
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

  formatDaysAgo(dateStr: string): string {
    const [year, month, day] = dateStr.slice(0, 10).split("-").map(Number);
    const sessionDay = Date.UTC(year, month - 1, day);
    const today = new Date();
    const todayDay = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const daysAgo = Math.max(0, Math.round((todayDay - sessionDay) / 86400000));

    if (daysAgo === 0) return "Today";
    return `${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
  }

  getExerciseDotClass(log: ExerciseLog): string {
    if (log.targetReps === undefined) return "history-dot";
    if (!log.completedSets.length) return "history-dot danger";

    const averageReps =
      log.completedSets.reduce((total, set) => total + set.reps, 0) /
      log.completedSets.length;

    if (averageReps >= log.targetReps) return "history-dot success";
    if (log.targetReps - averageReps <= 2) return "history-dot warn";
    return "history-dot danger";
  }
}
