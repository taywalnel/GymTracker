import { Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { PageHeaderComponent } from "../page-header/page-header.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

@Component({
  selector: "app-exercise-history-page",
  imports: [PageHeaderComponent, WeightAndRepsComponent],
  templateUrl: "./exercise-history-page.component.html",
  styleUrl: "./exercise-history-page.component.scss",
})
export class ExerciseHistoryPageComponent implements OnInit {
  exerciseName = "Exercise History";
  historyEntries: ExerciseHistoryEntry[] = [];
  isLoading = true;

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

    this.workoutService.getExerciseHistory(exerciseId).subscribe((entries) => {
      this.historyEntries = entries;
      this.exerciseName =
        entries[0]?.log.exerciseName ?? this.humanizeExerciseId(exerciseId);
      this.isLoading = false;
    });
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString(undefined, {
      weekday: "long",
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
