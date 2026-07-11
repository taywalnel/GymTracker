import { Component, OnInit } from "@angular/core";

import { ActivatedRoute, RouterLink } from "@angular/router";
import { WorkoutSession, ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { ButtonComponent } from "../button/button.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

interface CalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  inMonth: boolean;
  hasWorkout: boolean;
  isToday: boolean;
}

@Component({
    selector: "app-history",
    imports: [RouterLink, ButtonComponent],
    templateUrl: "./history.component.html",
    styleUrl: "./history.component.scss"
})
export class HistoryComponent implements OnInit {
  // Session-list mode
  sessions: WorkoutSession[] = [];

  // Single-exercise mode
  exerciseId: string | null = null;
  exerciseName: string | null = null;
  exerciseEntries: ExerciseHistoryEntry[] = [];

  // Calendar state
  calendarDays: CalendarDay[] = [];
  calendarMonth: Date = new Date();
  calendarMonthLabel = "";
  workoutDateSet = new Set<string>();

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
      this.sessions = sessions;
      this.workoutDateSet = new Set(sessions.map((s) => s.date));
      this.buildCalendar();
      this.isLoading = false;
    });
  }

  private loadExerciseHistory(exerciseId: string): void {
    this.isLoading = true;
    this.workoutService.getExerciseHistory(exerciseId).subscribe((entries) => {
      this.exerciseEntries = entries;
      this.exerciseName =
        entries[0]?.log.exerciseName ?? this.humanizeId(exerciseId);
      this.isLoading = false;
    });
  }

  private humanizeId(id: string): string {
    return id.replace("ex-", "").replace(/-/g, " ");
  }

  // ---- Calendar ----

  private buildCalendar(): void {
    const year = this.calendarMonth.getFullYear();
    const month = this.calendarMonth.getMonth();

    this.calendarMonthLabel = this.calendarMonth.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const days: CalendarDay[] = [];
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const todayStr = this.toLocalDateStr(new Date());

    // Pad start: Monday = 0, so convert JS Sunday=0 to Monday=0
    const startDow = (firstDay.getDay() + 6) % 7;
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push(this.makeDay(d, todayStr, false));
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      days.push(this.makeDay(date, todayStr, true));
    }

    // Pad end to fill the last row (up to 42 cells total for a 6-row grid)
    while (days.length % 7 !== 0) {
      const date = new Date(
        year,
        month + 1,
        days.length - startDow - lastDay.getDate() + 1,
      );
      days.push(this.makeDay(date, todayStr, false));
    }

    this.calendarDays = days;
  }

  private makeDay(date: Date, todayStr: string, inMonth: boolean): CalendarDay {
    const dateStr = this.toLocalDateStr(date);
    return {
      date,
      dateStr,
      inMonth,
      hasWorkout: this.workoutDateSet.has(dateStr),
      isToday: dateStr === todayStr,
    };
  }

  private toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  prevMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() - 1,
      1,
    );
    this.buildCalendar();
  }

  nextMonth(): void {
    this.calendarMonth = new Date(
      this.calendarMonth.getFullYear(),
      this.calendarMonth.getMonth() + 1,
      1,
    );
    this.buildCalendar();
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
