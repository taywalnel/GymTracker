import { Component, OnInit } from "@angular/core";

import { ActivatedRoute } from "@angular/router";
import { WorkoutSession, ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { ExerciseListItemComponent } from "../exercise-list-item/exercise-list-item.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { WeightAndRepsSet } from "../weight-and-reps/weight-and-reps.component";

interface ExerciseDisplay {
  log: ExerciseLog;
  weight: number;
  sets: WeightAndRepsSet[];
}

@Component({
  selector: "app-session-detail",
  imports: [ExerciseListItemComponent, PageHeaderComponent],
  templateUrl: "./session-detail.component.html",
  styleUrl: "./session-detail.component.scss",
})
export class SessionDetailComponent implements OnInit {
  session: WorkoutSession | null = null;
  exercises: ExerciseDisplay[] = [];
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get("sessionId") ?? "";
    this.workoutService.getSessionById(sessionId).subscribe((session) => {
      this.session = session;

      if (session) {
        this.exercises = session.exerciseLogs
          .filter((log) => log.completedSets.length > 0)
          .map((log) => ({
            log,
            weight: log.completedSets[0].weightKg,
            sets: log.completedSets.map((set) => ({
              targetAmount: log.targetReps ?? set.reps,
              achievedAmount:
                log.targetReps === undefined ? undefined : set.reps,
            })),
          }));
      }
      this.isLoading = false;
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
}
