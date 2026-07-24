import { Component, EventEmitter, Input, Output } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
  selector: "app-page-header",
  imports: [RouterLink],
  templateUrl: "./page-header.component.html",
  styleUrl: "./page-header.component.scss",
})
export class PageHeaderComponent {
  @Input() title: string | null = null;
  @Input() backLink: string | null = null;
  @Input() backLabel = "Back";
  @Input() showBack = false;
  @Output() back = new EventEmitter<void>();
}
