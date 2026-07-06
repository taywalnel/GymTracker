import { Injectable, signal, computed } from "@angular/core";
import { UnitSystem } from "../models/workout.models";

const KG_TO_LB = 2.20462;

/**
 * Single source of truth for the person's metric/imperial display preference.
 *
 * Weight is always stored in kilograms in the data layer (mock data and any
 * future backend). This service only affects *display*: converting kg to lb
 * for screen, and converting a person's lb input back to kg before it's saved.
 *
 * Default is metric, since the source data (the person's own notes) was
 * recorded in kg.
 */
@Injectable({ providedIn: "root" })
export class UnitPreferenceService {
  private readonly unitSystemSignal = signal<UnitSystem>("metric");

  readonly unitSystem = this.unitSystemSignal.asReadonly();
  readonly unitLabel = computed(() =>
    this.unitSystemSignal() === "metric" ? "kg" : "lb",
  );
  readonly isMetric = computed(() => this.unitSystemSignal() === "metric");

  setUnitSystem(system: UnitSystem): void {
    this.unitSystemSignal.set(system);
  }

  toggle(): void {
    this.unitSystemSignal.set(
      this.unitSystemSignal() === "metric" ? "imperial" : "metric",
    );
  }

  /** Converts a stored kg value to the currently displayed unit. */
  fromKg(kg: number): number {
    return this.unitSystemSignal() === "metric" ? kg : kg * KG_TO_LB;
  }

  /** Converts a value entered in the currently displayed unit back to kg for storage. */
  toKg(displayValue: number): number {
    return this.unitSystemSignal() === "metric"
      ? displayValue
      : displayValue / KG_TO_LB;
  }

  /**
   * The step size to use for the weight stepper, in the currently displayed
   * unit. 2.5 kg is a typical small-plate increment; 5 lb is the equivalent
   * common increment on imperial equipment (not a straight kg conversion,
   * since imperial gyms are plated in 5 lb steps, not 5.5).
   */
  get weightStep(): number {
    return this.unitSystemSignal() === "metric" ? 2.5 : 5;
  }

  /** Formats a kg value for display, converting and rounding sensibly for the current unit. */
  formatWeight(kg: number): string {
    const value = this.fromKg(kg);
    const rounded = Math.round(value * 10) / 10;
    return rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(1);
  }
}
