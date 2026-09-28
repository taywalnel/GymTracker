import { Component, EventEmitter, Input, Output } from "@angular/core";
import { UnitPreferenceService } from "../../../services/unit-preference.service";
import { StepperComponent } from "../../stepper/stepper.component";
import { UnitToggleComponent } from "../../unit-toggle/unit-toggle.component";

/** An exercise's targets, one entry per set; the set count is their length. */
export interface SetTargets {
  weightsKg: number[];
  reps: number[];
}

/**
 * Fits per-set values to a new set count: extra sets are dropped from the
 * end, and new sets copy the last set's value.
 */
export function resizeSetValues(
  values: readonly number[],
  setCount: number,
  fallback: number,
): number[] {
  const last = values[values.length - 1] ?? fallback;
  return Array.from({ length: setCount }, (_, index) => values[index] ?? last);
}

/**
 * Edits an exercise's sets, reps and target weight: the same for every set,
 * or a weight and reps for each set when "Different weight or reps per set"
 * is on.
 */
@Component({
  selector: "app-set-targets",
  imports: [StepperComponent, UnitToggleComponent],
  templateUrl: "./set-targets.component.html",
  styleUrl: "./set-targets.component.scss",
})
export class SetTargetsComponent {
  @Input({ required: true })
  set targets(value: SetTargets) {
    this._targets = value;
    // Targets that already differ (e.g. loaded after the first render) can
    // only be shown per set.
    if (differs(value.weightsKg) || differs(value.reps)) this.perSet = true;
  }
  get targets(): SetTargets {
    return this._targets;
  }

  @Output() targetsChange = new EventEmitter<SetTargets>();

  perSet = false;
  private _targets: SetTargets = { weightsKg: [0], reps: [1] };

  constructor(public units: UnitPreferenceService) {}

  get setCount(): number {
    return this.targets.reps.length;
  }

  toDisplay(weightKg: number): number {
    return Number(this.units.fromKg(weightKg).toFixed(1));
  }

  setPerSet(perSet: boolean): void {
    this.perSet = perSet;
    if (perSet) return;
    // Back to one of each: every set takes the first set's.
    const [weightKg = 0] = this.targets.weightsKg;
    const [reps = 1] = this.targets.reps;
    this.targetsChange.emit({
      weightsKg: this.targets.weightsKg.map(() => weightKg),
      reps: this.targets.reps.map(() => reps),
    });
  }

  setSetCount(count: number): void {
    this.targetsChange.emit({
      weightsKg: resizeSetValues(this.targets.weightsKg, count, 0),
      reps: resizeSetValues(this.targets.reps, count, 1),
    });
  }

  setAllWeights(displayWeight: number): void {
    const weightKg = this.units.toKg(displayWeight);
    this.targetsChange.emit({
      ...this.targets,
      weightsKg: this.targets.weightsKg.map(() => weightKg),
    });
  }

  setAllReps(reps: number): void {
    this.targetsChange.emit({
      ...this.targets,
      reps: this.targets.reps.map(() => reps),
    });
  }

  setWeight(setIndex: number, displayWeight: number): void {
    const weightKg = this.units.toKg(displayWeight);
    this.targetsChange.emit({
      ...this.targets,
      weightsKg: replaceAt(this.targets.weightsKg, setIndex, weightKg),
    });
  }

  setReps(setIndex: number, reps: number): void {
    this.targetsChange.emit({
      ...this.targets,
      reps: replaceAt(this.targets.reps, setIndex, reps),
    });
  }
}

function differs(values: readonly number[]): boolean {
  return values.some((value) => value !== values[0]);
}

function replaceAt(
  values: readonly number[],
  index: number,
  value: number,
): number[] {
  return values.map((current, i) => (i === index ? value : current));
}
