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
  @Input() showDelete = true;
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
  @Output() cardClick = new EventEmitter<void>();
}
