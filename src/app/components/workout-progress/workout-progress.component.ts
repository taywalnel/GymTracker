import { Component, Input } from "@angular/core";

@Component({
  selector: "app-workout-progress",
  templateUrl: "./workout-progress.component.html",
  styleUrl: "./workout-progress.component.scss",
})
export class WorkoutProgressComponent {
  @Input({ required: true }) completed = 0;
  @Input({ required: true }) total = 0;
  @Input() itemLabel = "exercise";

  get percentage(): number {
    return this.total === 0 ? 0 : (this.completed / this.total) * 100;
  }

  get label(): string {
    const item = this.total === 1 ? this.itemLabel : `${this.itemLabel}s`;
    return `${this.completed} out of ${this.total} ${item} complete`;
  }
}
