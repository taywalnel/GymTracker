import { Component, Input } from "@angular/core";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "icon";
export type ButtonSize = "default" | "sm";

@Component({
  selector: "app-button",
  standalone: true,
  imports: [],
  templateUrl: "./button.component.html",
  styleUrl: "./button.component.scss",
})
export class ButtonComponent {
  @Input() variant: ButtonVariant = "primary";
  @Input() size: ButtonSize = "default";
  @Input() fullWidth = false;
  @Input() disabled = false;
  @Input() danger = false;
  @Input() type: "button" | "submit" | "reset" = "button";
  @Input() height: string | null = null;
}
