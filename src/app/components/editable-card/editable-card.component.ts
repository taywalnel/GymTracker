import { Component, EventEmitter, Input, Output } from "@angular/core";

import { ButtonComponent } from "../button/button.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

@Component({
  selector: "app-editable-card",
  imports: [ButtonComponent, RoutineCardComponent],
  templateUrl: "./editable-card.component.html",
  styleUrl: "./editable-card.component.scss",
})
export class EditableCardComponent {
  @Input({ required: true }) title = "";
  @Input({ required: false }) description = "";
  @Input() active = false;
  @Input() showActive = false;
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() activeChange = new EventEmitter<boolean>();

  onActiveChange(event: Event): void {
    this.activeChange.emit((event.target as HTMLInputElement).checked);
  }
}
