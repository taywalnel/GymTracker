import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ExerciseLog, setTargetReps } from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { WEIGHT_TOLERANCE_KG } from "../../utils/rep-comparison";

export interface WeightAndRepsSet {
  targetAmount: number;
  achievedAmount?: number;
  /** The weight this set was done at; shown under the set when it differs from the main weight. */
  weightKg?: number;
}

/** Consecutive sets shown after one weight, keeping each set's overall index. */
export interface WeightAndRepsRow {
  weightKg: number;
  /** The overall index of the row's first set. */
  startIndex: number;
  sets: { set: WeightAndRepsSet; index: number }[];
}

export type WeightAndRepsStyle = "vibrant" | "muted";
export type WeightAndRepsSize = "large" | "small";

/** The weight most sets were done at (the earliest on a tie); null with no sets. */
export function mainWeightKg(weightsKg: readonly number[]): number | null {
  let main: number | null = null;
  let mainCount = 0;
  for (const weightKg of weightsKg) {
    const count = weightsKg.filter(
      (other) => Math.abs(other - weightKg) <= WEIGHT_TOLERANCE_KG,
    ).length;
    if (count > mainCount) {
      main = weightKg;
      mainCount = count;
    }
  }
  return main;
}

/** A logged exercise as sets for display, keeping each set's weight. */
export function logToWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
  return log.completedSets.map((set) => {
    const targetReps = setTargetReps(log, set);
    return {
      targetAmount: targetReps ?? set.reps,
      achievedAmount: targetReps === undefined ? undefined : set.reps,
      weightKg: set.weightKg,
    };
  });
}

@Component({
  selector: "app-weight-and-reps",
  imports: [],
  templateUrl: "./weight-and-reps.component.html",
  styleUrl: "./weight-and-reps.component.scss",
})
export class WeightAndRepsComponent {
  /** The main weight; defaults to the weight most sets were done at. */
  @Input() weight: number | null = null;
  @Input({ required: true }) sets!: WeightAndRepsSet[];
  @Input() activeIndex: number | null = null;
  @Input() size: WeightAndRepsSize = "large";
  /** Start a new row, with its own weight, whenever the weight changes between sets. */
  @Input() splitByWeight = false;

  @Output() setSelected = new EventEmitter<number>();

  constructor(public units: UnitPreferenceService) {}

  get displayWeightKg(): number {
    return (
      this.weight ??
      mainWeightKg(
        this.sets
          .map((set) => set.weightKg)
          .filter((weightKg) => weightKg !== undefined),
      ) ??
      0
    );
  }

  get rows(): WeightAndRepsRow[] {
    const mainWeightKg = this.displayWeightKg;
    const sets = this.sets.map((set, index) => ({ set, index }));
    if (!this.splitByWeight) {
      return [{ weightKg: mainWeightKg, startIndex: 0, sets }];
    }

    const rows: WeightAndRepsRow[] = [];
    for (const item of sets) {
      const weightKg = item.set.weightKg ?? mainWeightKg;
      const row = rows[rows.length - 1];
      if (row && Math.abs(row.weightKg - weightKg) <= WEIGHT_TOLERANCE_KG) {
        row.sets.push(item);
      } else {
        rows.push({ weightKg, startIndex: item.index, sets: [item] });
      }
    }
    return rows;
  }

  /** The set's own weight when it differs from the main weight, otherwise null. */
  setWeightLabel(set: WeightAndRepsSet): string | null {
    if (
      this.splitByWeight ||
      set.weightKg === undefined ||
      Math.abs(set.weightKg - this.displayWeightKg) <= WEIGHT_TOLERANCE_KG
    ) {
      return null;
    }
    return this.units.formatWeight(set.weightKg);
  }

  setAriaLabel(set: WeightAndRepsSet, index: number, rowWeightKg: number): string {
    const weightLabel = this.splitByWeight
      ? this.units.formatWeight(rowWeightKg)
      : this.setWeightLabel(set);
    return (
      `Select set ${index + 1}` +
      (weightLabel ? ` at ${weightLabel} ${this.units.unitLabel()}` : "")
    );
  }

  hasAchievedAmount(set: WeightAndRepsSet): boolean {
    return Boolean(set.achievedAmount);
  }

  isSuccessful(set: WeightAndRepsSet): boolean {
    return (
      this.hasAchievedAmount(set) && set.achievedAmount! >= set.targetAmount
    );
  }

  isWarning(set: WeightAndRepsSet): boolean {
    return (
      this.hasAchievedAmount(set) && set.achievedAmount! + 3 > set.targetAmount
    );
  }

  getSetClass(set: WeightAndRepsSet): string {
    if (!this.hasAchievedAmount(set)) return "set-container";
    if (this.isSuccessful(set)) return "set-container success";
    if (this.isWarning(set)) return "set-container warn";
    return "set-container danger";
  }
}
