import { Component, Input } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";

export interface WeightAndRepsSet {
  value: number;
  color?: string;
  textColor?: string;
}

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

  constructor(public units: UnitPreferenceService) {}
}
