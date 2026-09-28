import { Component, Input, inject } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import {
  CHEVRON_LEFT_SVG,
  CHEVRON_RIGHT_SVG,
  DELETE_SVG,
  EDIT_SVG,
  HISTORY_SVG,
  PLUS_SVG,
  SPARKLE_SVG,
} from "../../constants/svg.constants";

// The variant sets how prominent a button is; `danger` only changes its tone.
// Use at most one primary per screen and secondary for everything else.
export type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonIconName =
  | "chevron-left"
  | "chevron-right"
  | "delete"
  | "edit"
  | "history"
  | "plus"
  | "sparkle";

const BUTTON_ICONS: Record<ButtonIconName, string> = {
  "chevron-left": CHEVRON_LEFT_SVG,
  "chevron-right": CHEVRON_RIGHT_SVG,
  delete: DELETE_SVG,
  edit: EDIT_SVG,
  history: HISTORY_SVG,
  plus: PLUS_SVG,
  sparkle: SPARKLE_SVG,
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
  @Input() size: ButtonSize = "md";
  @Input() fullWidth = false;
  // Fill the parent's height, e.g. to match a neighbouring control.
  @Input() stretch = false;
  @Input() disabled = false;
  // Shows a spinner in place of the label and blocks clicks, keeping the width.
  @Input() loading = false;
  @Input() selected = false;
  @Input() danger = false;
  @Input() ariaLabel: string | null = null;
  @Input() type: "button" | "submit" | "reset" = "button";

  // Built only when the icon changes so the [innerHTML] binding stays stable
  // instead of re-rendering the SVG on every change detection. Icon buttons
  // show it alone; other variants show it before the label.
  iconSvg: SafeHtml | null = null;

  @Input() set iconName(name: ButtonIconName | null) {
    this.iconSvg = name
      ? this.sanitizer.bypassSecurityTrustHtml(BUTTON_ICONS[name])
      : null;
  }
}
