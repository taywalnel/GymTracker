import { Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
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
  ],
  templateUrl: "./exercise-history-page.component.html",
  styleUrl: "./exercise-history-page.component.scss",
})
export class ExerciseHistoryPageComponent implements OnInit {
  exerciseName = "Exercise";
  historyEntries: ExerciseHistoryEntry[] = [];
  activeTab = "Progression";
  isLoading = true;

  get historyTabs(): PageHeaderTab[] {
    return [
      { label: "Progression" },
      { label: "History", count: this.completedEntries.length },
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
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    const exerciseId = this.route.snapshot.paramMap.get("exerciseId");
    if (!exerciseId) {
      this.isLoading = false;
      return;
    }

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

  goBack(): void {
    this.location.back();
  }
}
