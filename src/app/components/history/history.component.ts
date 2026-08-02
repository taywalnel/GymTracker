import { Component, OnInit } from "@angular/core";

import { ActivatedRoute, RouterLink } from "@angular/router";
import { WorkoutSession, ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { CalendarComponent } from "../calendar/calendar.component";
import { PageHeaderComponent } from "../page-header/page-header.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

@Component({
  selector: "app-history",
  imports: [RouterLink, CalendarComponent, PageHeaderComponent],
  templateUrl: "./history.component.html",
  styleUrl: "./history.component.scss",
})
export class HistoryComponent implements OnInit {
  // Session-list mode
  sessions: WorkoutSession[] = [];
  workoutDates: string[] = [];

  // Single-exercise mode
  exerciseId: string | null = null;
  exerciseName: string | null = null;
  exerciseEntries: ExerciseHistoryEntry[] = [];

  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.exerciseId = params.get("exerciseId");
      if (this.exerciseId) {
        this.loadExerciseHistory(this.exerciseId);
      } else {
        this.loadSessionHistory();
      }
    });
  }

  private loadSessionHistory(): void {
    this.isLoading = true;
    this.workoutService.getSessionHistory().subscribe((sessions) => {
      this.setSessionHistory(sessions);
      this.isLoading = false;
    });
  }

  private loadExerciseHistory(exerciseId: string): void {
    this.isLoading = true;
    this.workoutService.getExerciseHistory(exerciseId).subscribe((entries) => {
      this.setExerciseHistory(exerciseId, entries);
      this.isLoading = false;
    });
  }

  private setSessionHistory(sessions: WorkoutSession[]): void {
    this.sessions = sessions;
    this.workoutDates = sessions.map((session) => session.date);
  }

  private setExerciseHistory(
    exerciseId: string,
    entries: ExerciseHistoryEntry[],
  ): void {
    this.exerciseEntries = entries;
    this.exerciseName =
      entries[0]?.log.exerciseName ?? this.humanizeId(exerciseId);
  }

  private findExerciseEntries(
    exerciseId: string,
    sessions: WorkoutSession[],
  ): ExerciseHistoryEntry[] {
    return sessions
      .filter((session) => !session.inProgress)
      .flatMap((session) => {
        const log = session.exerciseLogs.find(
          (entry) => entry.exerciseId === exerciseId,
        );
        return log ? [{ date: session.date, log }] : [];
      });
  }

  private humanizeId(id: string): string {
    return id.replace("ex-", "").replace(/-/g, " ");
  }

  // ---- Session list ----

  formatSetReps(log: ExerciseLog): string {
    return log.completedSets.map((s) => s.reps).join(" / ") || "—";
  }

  formatSetWeight(log: ExerciseLog): string {
    if (!log.completedSets.length || log.completedSets[0].weightKg === 0)
      return "";
    return (
      this.units.formatWeight(log.completedSets[0].weightKg) +
      " " +
      this.units.unitLabel()
    );
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
}
