import { Component, Input } from "@angular/core";
import { ExerciseLog } from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
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

@Component({
  selector: "app-exercise-progression",
  imports: [WeightAndRepsComponent],
  templateUrl: "./exercise-progression.component.html",
  styleUrl: "./exercise-progression.component.scss",
})
export class ExerciseProgressionComponent {
  @Input() entries: ExerciseHistoryEntry[] = [];

  constructor(public units: UnitPreferenceService) {}

  get chartPoints(): ProgressPoint[] {
    const values = this.entries.map((entry) => this.sessionVolume(entry.log));
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
      this.entries.map((entry) => this.sessionVolume(entry.log)),
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
        Math.max(
          best,
          ...entry.log.completedSets.map(
            (set) => set.weightKg * (1 + set.reps / 30),
          ),
        ),
      0,
    );
  }

  get bestSessionVolumeEntry(): ExerciseHistoryEntry | undefined {
    return this.entries
      .filter((entry) => entry.log.completedSets.length > 0)
      .reduce<
        ExerciseHistoryEntry | undefined
      >((best, entry) => (!best || this.sessionVolume(entry.log) > this.sessionVolume(best.log) ? entry : best), undefined);
  }

  get bestSessionVolumeKg(): number {
    return this.bestSessionVolumeEntry
      ? this.sessionVolume(this.bestSessionVolumeEntry.log)
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
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
}
