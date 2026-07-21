import { Component, EventEmitter, Input, Output } from "@angular/core";

export interface NavDotItem {
  id: string | number;
  isActive: boolean;
  isComplete: boolean;
  /** True when the set was completed but reps fell short of the target. */
  isShort?: boolean;
  /** Text shown inside the dot (e.g. rep count for completed sets). */
  label?: string | number;
  ariaLabel: string;
}

@Component({
  selector: "app-nav-dots",
  imports: [],
  templateUrl: "./nav-dots.component.html",
  styleUrl: "./nav-dots.component.scss",
})
export class NavDotsComponent {
  @Input({ required: true }) items: NavDotItem[] = [];
  /**
   * `packed`  — left-aligned with a gap (default, used for set-nav).
   * `spread`  — space-between full width (used for exercise-nav).
   */
  @Input() layout: "packed" | "spread" = "packed";
  /** When true, renders all dots with muted/historical styling. */
  @Input() muted = false;
}
