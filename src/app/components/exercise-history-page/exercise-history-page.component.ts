import { Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { forkJoin } from "rxjs";
import { ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import {
  ExerciseHistoryEntry,
  ExerciseProgressionComponent,
} from "../exercise-progression/exercise-progression.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../page-header/page-header.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import { ButtonComponent } from "../button/button.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";

@Component({
  selector: "app-exercise-history-page",
  imports: [
    ExerciseProgressionComponent,
    PageHeaderComponent,
    LoadingSpinnerComponent,
    WeightAndRepsComponent,
    ButtonComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: "./exercise-history-page.component.html",
  styleUrl: "./exercise-history-page.component.scss",
})
export class ExerciseHistoryPageComponent implements OnInit {
  exerciseName = "Exercise";
  historyEntries: ExerciseHistoryEntry[] = [];
  activeTab = "Progression";
  isLoading = true;
  exerciseId: string | null = null;
  isDeleting = false;
  showDeleteConfirmation = false;

  get historyTabs(): PageHeaderTab[] {
    return [
      { label: "Progression" },
      { label: "History", count: this.completedEntries.length },
      { label: "Manage" },
    ];
  }

  get completedEntries(): ExerciseHistoryEntry[] {
    return this.historyEntries.filter(
      (entry) => entry.log.completedSets.length > 0,
    );
  }

  get historyDisplayEntries(): ExerciseHistoryEntry[] {
    return this.completedEntries.slice().reverse();
  }

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    const exerciseId = this.route.snapshot.paramMap.get("exerciseId");
    if (!exerciseId) {
      this.isLoading = false;
      return;
    }
    this.exerciseId = exerciseId;

    forkJoin({
      entries: this.workoutService.getExerciseHistory(exerciseId),
      exercises: this.workoutService.getAllExercises(),
    }).subscribe(({ entries, exercises }) => {
      this.historyEntries = entries
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date));
      this.exerciseName =
        exercises.find((exercise) => exercise.id === exerciseId)?.name ??
        this.historyEntries[0]?.log.exerciseName ??
        this.humanizeExerciseId(exerciseId);
      this.isLoading = false;
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString("en-GB", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  toWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
    return log.completedSets.map((set) => ({
      targetAmount: log.targetReps ?? set.reps,
      achievedAmount: log.targetReps === undefined ? undefined : set.reps,
    }));
  }

  private humanizeExerciseId(id: string): string {
    return id.replace("ex-", "").replace(/-/g, " ");
  }

  editExercise(): void {
    if (!this.exerciseId) return;
    this.router.navigate(["/program/exercises/edit", this.exerciseId]);
  }

  deleteExercise(): void {
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDelete(): void {
    if (!this.exerciseId || this.isDeleting) return;

    this.isDeleting = true;
    this.workoutService.deleteExercise(this.exerciseId).subscribe({
      next: () => this.router.navigate(["/program/exercises"]),
      error: () => {
        this.isDeleting = false;
        this.showDeleteConfirmation = false;
      },
    });
  }

  goBack(): void {
    this.location.back();
  }
}
