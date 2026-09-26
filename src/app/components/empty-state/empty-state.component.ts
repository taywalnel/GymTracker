import { Component, Input } from "@angular/core";

// Shown in place of a list or panel that has nothing in it yet. Project the
// action that fills it (usually one primary app-button) as content.
@Component({
  selector: "app-empty-state",
  templateUrl: "./empty-state.component.html",
  styleUrl: "./empty-state.component.scss",
})
export class EmptyStateComponent {
  @Input({ required: true }) title!: string;
  @Input() message: string | null = null;
}
