import { DecimalPipe, Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { forkJoin } from "rxjs";
import { ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

interface ProgressPoint {
  date: string;
  label: string;
  valueKg: number;
  x: number;
  y: number;
}

interface ChartDomain {
  min: number;
  max: number;
}

@Component({
  selector: "app-exercise-history-page",
  imports: [
    DecimalPipe,
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

  get completedEntries(): ExerciseHistoryEntry[] {
    return this.historyEntries.filter(
      (entry) => entry.log.completedSets.length > 0,
    );
  }

  get historyDisplayEntries(): ExerciseHistoryEntry[] {
    return this.completedEntries.slice().reverse();
  }

  get chartPoints(): ProgressPoint[] {
    const values = this.completedEntries.map((entry) =>
      this.sessionVolume(entry.log),
    );
    const { min, max } = this.chartDomain(values);

    return this.completedEntries.map((entry, index) => {
      const value = values[index];
      return {
        date: entry.date,
        label: this.shortDate(entry.date),
        valueKg: value,
        x: values.length === 1 ? 50 : (index / (values.length - 1)) * 100,
        y: max === min ? 50 : 92 - ((value - min) / (max - min)) * 76,
      };
    });
  }

  get chartLinePoints(): string {
    return this.chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  }

  get chartAreaPoints(): string {
    const points = this.chartPoints;
    if (points.length === 0) return "";
    return `${points[0].x},100 ${this.chartLinePoints} ${points.at(-1)!.x},100`;
  }

  get chartAxisLabels(): number[] {
    const { min, max } = this.chartDomain(
      this.completedEntries.map((entry) => this.sessionVolume(entry.log)),
    );
    return Array.from(
      { length: 4 },
      (_, index) => max - ((max - min) * index) / 3,
    );
  }

  get latestPoint(): ProgressPoint | undefined {
    return this.chartPoints.at(-1);
  }

  get bestPoint(): ProgressPoint | undefined {
    return this.chartPoints.reduce<ProgressPoint | undefined>(
      (best, point) => (!best || point.valueKg > best.valueKg ? point : best),
      undefined,
    );
  }

  get progressChange(): number | null {
    const points = this.chartPoints;
    if (points.length < 2 || points[0].valueKg === 0) return null;
    return (
      ((points.at(-1)!.valueKg - points[0].valueKg) / points[0].valueKg) * 100
    );
  }

  get heaviestWeightKg(): number {
    return this.historyEntries.reduce(
      (heaviest, entry) =>
        Math.max(
          heaviest,
          ...entry.log.completedSets.map((set) => set.weightKg),
        ),
      0,
    );
  }

  get estimatedOneRepMaxKg(): number {
    return this.historyEntries.reduce(
      (best, entry) =>
        Math.max(
          best,
          ...entry.log.completedSets.map(
            (set) => set.weightKg * (1 + set.reps / 30),
          ),
        ),
      0,
    );
  }

  get metricTitle(): string {
    return "Session volume";
  }

  constructor(
    private location: Location,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
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

  formatValue(valueKg: number): string {
    return `${this.units.formatWeight(valueKg)} ${this.units.unitLabel()}`;
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

  private sessionVolume(log: ExerciseLog): number {
    return log.completedSets.reduce(
      (total, set) => total + set.weightKg * set.reps,
      0,
    );
  }

  private chartDomain(values: number[]): ChartDomain {
    if (values.length === 0) return { min: 0, max: 1 };

    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding =
      rawMax === rawMin ? Math.max(rawMax * 0.05, 1) : (rawMax - rawMin) * 0.1;

    return {
      min: Math.max(0, rawMin - padding),
      max: rawMax + padding,
    };
  }

  private shortDate(date: string): string {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  private humanizeExerciseId(id: string): string {
    return id.replace("ex-", "").replace(/-/g, " ");
  }

  goBack(): void {
    this.location.back();
  }
}
