import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonComponent } from "../button/button.component";

@Component({
  selector: "app-confirmation-modal",
  imports: [ButtonComponent],
  templateUrl: "./confirmation-modal.component.html",
  styleUrl: "./confirmation-modal.component.scss",
})
export class ConfirmationModalComponent {
  @Input({ required: true }) title = "Confirm action";
  @Input({ required: true }) message = "Are you sure you want to continue?";
  @Input() confirmLabel = "Confirm";
  @Input() cancelLabel = "Cancel";
  @Input() danger = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  cancel(): void {
    this.cancelled.emit();
  }

  confirm(): void {
    this.confirmed.emit();
  }
}
