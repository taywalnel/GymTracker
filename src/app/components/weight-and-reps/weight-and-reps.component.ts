import { Component, EventEmitter, Input, Output } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";

export interface WeightAndRepsSet {
  targetAmount: number;
  achievedAmount?: number;
}

export type WeightAndRepsStyle = "vibrant" | "muted";
export type WeightAndRepsSize = "large" | "small";

@Component({
  selector: "app-weight-and-reps",
  imports: [],
  templateUrl: "./weight-and-reps.component.html",
  styleUrl: "./weight-and-reps.component.scss",
})
export class WeightAndRepsComponent {
  @Input({ required: true }) weight!: number;
  @Input({ required: true }) sets!: WeightAndRepsSet[];
  @Input() activeIndex: number | null = null;
  @Input() size: WeightAndRepsSize = "large";

  @Output() setSelected = new EventEmitter<number>();

  constructor(public units: UnitPreferenceService) {}

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
