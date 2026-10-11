import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { ExerciseLog, setTargetReps } from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { WEIGHT_TOLERANCE_KG } from "../../utils/rep-comparison";

export interface SetStripSet {
  targetAmount: number;
  achievedAmount?: number;
  /** The weight this set was done at. */
  weightKg?: number;
}

export type SetStatus = "pending" | "good" | "close" | "miss";
export type SetStripSize = "large" | "small";

/** A logged exercise as sets for display, keeping each set's weight. */
export function logToSetStripSets(log: ExerciseLog): SetStripSet[] {
  return log.completedSets.map((set) => {
    const targetReps = setTargetReps(log, set);
    return {
      targetAmount: targetReps ?? set.reps,
      achievedAmount: targetReps === undefined ? undefined : set.reps,
      weightKg: set.weightKg,
    };
  });
}

// Tiles are a fixed size so the ring can be placed by index, and the layout
// doesn't shift when a weight moves from the label into the tiles. These
// match the sizes in the stylesheet.
const TILE_SIZES: Record<SetStripSize, { tilePx: number; gapPx: number }> = {
  large: { tilePx: 48, gapPx: 6 },
  small: { tilePx: 40, gapPx: 4 },
};
/** Padding around the tiles that keeps the ring from being clipped. */
const RING_ROOM_PX = 4;

/**
 * One row of set tiles under a label. A weight shared by every set shows once
 * in the label; when the weights differ, each tile shows its own.
 */
@Component({
  selector: "app-set-strip",
  imports: [NgTemplateOutlet],
  templateUrl: "./set-strip.component.html",
  styleUrl: "./set-strip.component.scss",
  host: { "[class.set-strip--small]": "size === 'small'" },
})
export class SetStripComponent implements AfterViewChecked {
  /** Optional; without it the label row shows only a shared weight. */
  @Input() label = "";
  @Input({ required: true }) sets!: SetStripSet[];
  /** The set being done; tiles can be tapped to select a set while it's set. */
  @Input() activeIndex: number | null = null;
  @Input() size: SetStripSize = "large";

  @Output() setSelected = new EventEmitter<number>();

  @ViewChild("track") private track?: ElementRef<HTMLElement>;
  private scrolledToIndex: number | null = null;

  constructor(public units: UnitPreferenceService) {}

  get isInteractive(): boolean {
    return this.activeIndex !== null;
  }

  /** The weight every set shares, or null when they differ or none is known. */
  get sharedWeightKg(): number | null {
    const weightsKg = this.knownWeightsKg;
    if (weightsKg.length === 0) return null;
    return weightsKg.every(
      (weightKg) => Math.abs(weightKg - weightsKg[0]) <= WEIGHT_TOLERANCE_KG,
    )
      ? weightsKg[0]
      : null;
  }

  /** Each tile shows its own weight only when the sets' weights differ. */
  get showsTileWeights(): boolean {
    return this.knownWeightsKg.length > 0 && this.sharedWeightKg === null;
  }

  ringTransform(index: number): string {
    return `translateX(${index * this.columnPx}px)`;
  }

  shownReps(set: SetStripSet): number {
    return set.achievedAmount || set.targetAmount;
  }

  status(set: SetStripSet): SetStatus {
    if (!set.achievedAmount) return "pending";
    if (set.achievedAmount >= set.targetAmount) return "good";
    if (set.achievedAmount + 3 > set.targetAmount) return "close";
    return "miss";
  }

  tileAriaLabel(set: SetStripSet, index: number): string {
    const weight =
      set.weightKg === undefined
        ? ""
        : ` at ${this.units.formatWeight(set.weightKg)} ${this.units.unitLabel()}`;
    return `Set ${index + 1}: ${this.shownReps(set)} reps${weight}`;
  }

  // Keeps the active set in view when there are more sets than fit.
  ngAfterViewChecked(): void {
    const index = this.activeIndex;
    const track = this.track?.nativeElement;
    if (index === null || !track || index === this.scrolledToIndex) return;
    this.scrolledToIndex = index;

    const start = index * this.columnPx;
    const end = start + TILE_SIZES[this.size].tilePx + 2 * RING_ROOM_PX;
    if (start < track.scrollLeft) {
      track.scrollLeft = start;
    } else if (end > track.scrollLeft + track.clientWidth) {
      track.scrollLeft = end - track.clientWidth;
    }
  }

  private get columnPx(): number {
    const { tilePx, gapPx } = TILE_SIZES[this.size];
    return tilePx + gapPx;
  }

  private get knownWeightsKg(): number[] {
    return this.sets
      .map((set) => set.weightKg)
      .filter((weightKg) => weightKg !== undefined);
  }
}
