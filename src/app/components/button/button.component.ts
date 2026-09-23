import { Component, Input, inject } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import {
  CHEVRON_LEFT_SVG,
  CHEVRON_RIGHT_SVG,
  DELETE_SVG,
  EDIT_SVG,
  HISTORY_SVG,
} from "../../constants/svg.constants";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "icon"
  | "complete"
  | "danger";
export type ButtonSize = "default" | "sm";
export type ButtonIconName =
  | "chevron-left"
  | "chevron-right"
  | "delete"
  | "edit"
  | "history";

const BUTTON_ICONS: Record<ButtonIconName, string> = {
  "chevron-left": CHEVRON_LEFT_SVG,
  "chevron-right": CHEVRON_RIGHT_SVG,
  delete: DELETE_SVG,
  edit: EDIT_SVG,
  history: HISTORY_SVG,
};

@Component({
  selector: "app-button",
  imports: [],
  templateUrl: "./button.component.html",
  styleUrl: "./button.component.scss",
})
export class ButtonComponent {
  private readonly sanitizer = inject(DomSanitizer);

  @Input() variant: ButtonVariant = "primary";
  @Input() size: ButtonSize = "default";
  @Input() fullWidth = false;
  @Input() disabled = false;
  @Input() selected = false;
  @Input() danger = false;
  @Input() ariaLabel: string | null = null;
  @Input() type: "button" | "submit" | "reset" = "button";
  @Input() height: string | null = null;
  @Input() iconName: ButtonIconName | null = null;

  get iconSvg(): SafeHtml | null {
    return this.iconName
      ? this.sanitizer.bypassSecurityTrustHtml(BUTTON_ICONS[this.iconName])
      : null;
  }
}
