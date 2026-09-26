import { Component, OnInit, ViewChild } from "@angular/core";

import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { WorkoutSession, ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { CalendarComponent } from "../calendar/calendar.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../page-header/page-header.component";
import { ButtonComponent } from "../button/button.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

@Component({
  selector: "app-history",
  imports: [
    RouterLink,
    ButtonComponent,
    CalendarComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RoutineCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./history.component.html",
  styleUrl: "./history.component.scss",
})
export class HistoryComponent implements OnInit {
  @ViewChild(CalendarComponent) private calendar?: CalendarComponent;
  activeTab = "Overview";

  get historyTabs(): PageHeaderTab[] {
    return [
      { label: "Overview" },
      { label: "Activities", count: this.completedSessions.length },
    ];
  }

  // Session-list mode
  sessions: WorkoutSession[] = [];
  workoutDates: string[] = [];
  overviewMonthLabel = "";
  completedWorkouts = 0;
  averageWorkoutsPerWeek = "0.0";
  longestStreak = 0;

  get completedSessions(): WorkoutSession[] {
    return this.sessions.filter((session) => !session.inProgress);
  }

  get isCurrentMonth(): boolean {
    return this.calendar?.isCurrentMonth ?? true;
  }

  // Single-exercise mode
  exerciseId: string | null = null;
  exerciseName: string | null = null;
  exerciseEntries: ExerciseHistoryEntry[] = [];

  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
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
    this.workoutDates = sessions
      .filter((session) => !session.inProgress)
      .map((session) => session.date);
  }

  onCalendarMonthChange(month: Date): void {
    queueMicrotask(() => this.updateMonthOverview(month));
  }

  private updateMonthOverview(month: Date): void {
    this.overviewMonthLabel = month.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });

    const monthSessions = this.sessions.filter(
      (session) =>
        !session.inProgress && this.isDateInMonth(session.date, month),
    );
    const daysInMonth = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    const today = new Date();
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const currentMonthStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
    );
    const elapsedDays =
      monthStart > currentMonthStart
        ? 0
        : monthStart.getTime() === currentMonthStart.getTime()
          ? today.getDate()
          : daysInMonth;

    this.completedWorkouts = monthSessions.length;
    this.averageWorkoutsPerWeek = (
      elapsedDays === 0 ? 0 : monthSessions.length / (elapsedDays / 7)
    ).toFixed(1);
    this.longestStreak = this.getLongestStreak(monthSessions);
  }

  previousMonth(): void {
    this.calendar?.prevMonth();
  }

  nextMonth(): void {
    this.calendar?.nextMonth();
  }

  private isDateInMonth(dateStr: string, month: Date): boolean {
    const [year, monthNumber] = dateStr.slice(0, 10).split("-").map(Number);
    return year === month.getFullYear() && monthNumber === month.getMonth() + 1;
  }

  private getLongestStreak(sessions: WorkoutSession[]): number {
    const workoutDays = new Set(
      sessions.map((session) => session.date.slice(0, 10)),
    );
    const sortedDays = [...workoutDays].sort();
    let longest = 0;
    let current = 0;
    let previousDay: Date | null = null;

    for (const dateStr of sortedDays) {
      const date = this.parseLocalDate(dateStr);
      if (previousDay && date.getTime() - previousDay.getTime() === 86400000) {
        current += 1;
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
      previousDay = date;
    }

    return longest;
  }

  private parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
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

  startWorkout(): void {
    this.router.navigate(["/"]);
  }

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
