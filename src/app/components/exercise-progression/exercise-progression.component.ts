import { Component, Input } from "@angular/core";
import { ExerciseLog } from "../../models/workout.models";
import { formatLocalDate } from "../../utils/dates";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import {
  estimatedOneRepMax,
  sessionVolume,
} from "../../utils/personal-records";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";

export interface ExerciseHistoryEntry {
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

/** What the trend chart plots for each session. */
export type ProgressMetric = "oneRepMax" | "topWeight" | "volume";

interface MetricOption {
  value: ProgressMetric;
  label: string;
  title: string;
}

const METRIC_STORAGE_KEY = "gym:progressMetric";

const METRIC_OPTIONS: MetricOption[] = [
  { value: "oneRepMax", label: "Est. 1RM", title: "Estimated 1-rep max" },
  { value: "topWeight", label: "Top set", title: "Heaviest set" },
  { value: "volume", label: "Volume", title: "Session volume" },
];

@Component({
  selector: "app-exercise-progression",
  imports: [WeightAndRepsComponent],
  templateUrl: "./exercise-progression.component.html",
  styleUrl: "./exercise-progression.component.scss",
})
export class ExerciseProgressionComponent {
  @Input() entries: ExerciseHistoryEntry[] = [];

  readonly metricOptions = METRIC_OPTIONS;
  /** Remembered per device, so the chart opens on the last metric viewed. */
  metric: ProgressMetric = readStoredMetric();

  constructor(public units: UnitPreferenceService) {}

  get metricTitle(): string {
    return METRIC_OPTIONS.find((option) => option.value === this.metric)!.title;
  }

  selectMetric(metric: ProgressMetric): void {
    this.metric = metric;
    try {
      localStorage.setItem(METRIC_STORAGE_KEY, metric);
    } catch (e) {
      // ignore storage errors
    }
  }

  get chartPoints(): ProgressPoint[] {
    const values = this.entries.map((entry) => this.metricValue(entry.log));
    const { min, max } = this.chartDomain(values);

    return this.entries.map((entry, index) => {
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
      this.entries.map((entry) => this.metricValue(entry.log)),
    );
    return Array.from(
      { length: 4 },
      (_, index) => max - ((max - min) * index) / 3,
    );
  }

  get heaviestWeightKg(): number {
    return this.entries.reduce(
      (heaviest, entry) =>
        Math.max(
          heaviest,
          ...entry.log.completedSets.map((set) => set.weightKg),
        ),
      0,
    );
  }

  get estimatedOneRepMaxKg(): number {
    return this.entries.reduce(
      (best, entry) =>
        Math.max(best, ...entry.log.completedSets.map(estimatedOneRepMax)),
      0,
    );
  }

  get bestSessionVolumeEntry(): ExerciseHistoryEntry | undefined {
    return this.entries
      .filter((entry) => entry.log.completedSets.length > 0)
      .reduce<ExerciseHistoryEntry | undefined>(
        (best, entry) =>
          !best || sessionVolume(entry.log) > sessionVolume(best.log)
            ? entry
            : best,
        undefined,
      );
  }

  get bestSessionVolumeKg(): number {
    return this.bestSessionVolumeEntry
      ? sessionVolume(this.bestSessionVolumeEntry.log)
      : 0;
  }

  toWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
    return log.completedSets.map((set) => ({
      targetAmount: set.reps,
    }));
  }

  formatValue(valueKg: number): string {
    return `${this.units.formatWeight(valueKg)} ${this.units.unitLabel()}`;
  }

  formatDate(date: string): string {
    return formatLocalDate(date, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  private metricValue(log: ExerciseLog): number {
    switch (this.metric) {
      case "oneRepMax":
        return Math.max(0, ...log.completedSets.map(estimatedOneRepMax));
      case "topWeight":
        return Math.max(0, ...log.completedSets.map((set) => set.weightKg));
      case "volume":
        return sessionVolume(log);
    }
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
    return formatLocalDate(date, {
      month: "short",
      day: "numeric",
    });
  }
}

function readStoredMetric(): ProgressMetric {
  try {
    const stored = localStorage.getItem(METRIC_STORAGE_KEY);
    return (
      METRIC_OPTIONS.find((option) => option.value === stored)?.value ??
      "oneRepMax"
    );
  } catch (e) {
    return "oneRepMax";
  }
}
