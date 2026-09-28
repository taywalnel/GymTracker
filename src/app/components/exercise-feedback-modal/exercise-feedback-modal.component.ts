import { Component, EventEmitter, Input, Output } from "@angular/core";
import {
  ExerciseFeedback,
  FeedbackPrescription,
} from "../../models/exercise-feedback.models";
import { formatTargetReps } from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { ButtonComponent } from "../button/button.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";

/** Shows AI feedback on an exercise's targets, with the change to apply if any. */
@Component({
  selector: "app-exercise-feedback-modal",
  imports: [ButtonComponent, LoadingSpinnerComponent],
  templateUrl: "./exercise-feedback-modal.component.html",
  styleUrl: "./exercise-feedback-modal.component.scss",
  host: {
    "(document:keydown.escape)": "close()",
  },
})
export class ExerciseFeedbackModalComponent {
  @Input() feedback: ExerciseFeedback | null = null;
  @Input() isLoading = false;
  @Input() error: string | null = null;
  @Input({ required: true }) current!: FeedbackPrescription;
  /** True when the change can go into today's workout, not just the next one. */
  @Input() appliesToday = false;
  @Input() isApplying = false;

  @Output() apply = new EventEmitter<void>();
  @Output() retry = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  constructor(public units: UnitPreferenceService) {}

  get recommendation(): FeedbackPrescription | undefined {
    return this.feedback?.verdict === "change"
      ? this.feedback.recommendation
      : undefined;
  }

  get title(): string {
    if (this.isLoading) return "Reviewing your history";
    if (this.error) return "Couldn't get feedback";
    return this.recommendation ? "Suggested change" : "Keep it as is";
  }

  /** e.g. "3 × 8 @ 60 kg" or "12/10/8 @ 50–60 kg". */
  formatSets(prescription: FeedbackPrescription): string {
    const reps = formatTargetReps(prescription.setReps);
    const sets = prescription.setReps.every(
      (count) => count === prescription.setReps[0],
    )
      ? `${prescription.setReps.length} × ${reps}`
      : reps;
    const weight = this.units.formatWeightRange(prescription.setWeightsKg);
    return `${sets} @ ${weight} ${this.units.unitLabel()}`;
  }

  formatRest(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = String(seconds % 60).padStart(2, "0");
    return `${minutes}:${rest} rest`;
  }

  close(): void {
    this.closed.emit();
  }
}
