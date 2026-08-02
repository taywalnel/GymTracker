import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

import { DELETE_SVG, EDIT_SVG } from "../../constants/svg.constants";
import { ButtonComponent } from "../button/button.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

@Component({
  selector: "app-editable-card",
  imports: [ButtonComponent, RoutineCardComponent],
  templateUrl: "./editable-card.component.html",
  styleUrl: "./editable-card.component.scss",
})
export class EditableCardComponent {
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly deleteSvg =
    this.sanitizer.bypassSecurityTrustHtml(DELETE_SVG);
  protected readonly editSvg = this.sanitizer.bypassSecurityTrustHtml(EDIT_SVG);

  @Input({ required: true }) title = "";
  @Input({ required: false }) description = "";
  @Output() edit = new EventEmitter<void>();
  @Output() delete = new EventEmitter<void>();
}
