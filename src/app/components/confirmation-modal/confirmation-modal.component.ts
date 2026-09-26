import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonComponent } from "../button/button.component";

@Component({
  selector: "app-confirmation-modal",
  imports: [ButtonComponent],
  templateUrl: "./confirmation-modal.component.html",
  styleUrl: "./confirmation-modal.component.scss",
  host: {
    "(document:keydown.escape)": "cancel()",
  },
})
export class ConfirmationModalComponent {
  private static nextId = 0;
  private readonly id = ConfirmationModalComponent.nextId++;
  readonly titleId = `confirmation-modal-title-${this.id}`;
  readonly messageId = `confirmation-modal-message-${this.id}`;

  @Input({ required: true }) title = "Confirm action";
  @Input({ required: true }) message = "Are you sure you want to continue?";
  @Input() confirmLabel = "Confirm";
  @Input() cancelLabel = "Cancel";
  @Input() secondaryLabel = "";
  // An extra full-width action above Cancel; only shown alongside a secondary action.
  @Input() tertiaryLabel = "";
  @Input() danger = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();
  @Output() secondary = new EventEmitter<void>();
  @Output() tertiary = new EventEmitter<void>();

  cancel(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    this.confirmed.emit();
  }

  triggerSecondary(): void {
    this.secondary.emit();
  }

  triggerTertiary(): void {
    this.tertiary.emit();
  }
}
