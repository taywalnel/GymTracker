import { Component, HostBinding, Input } from "@angular/core";

@Component({
  selector: "app-card, li[app-card]",
  templateUrl: "./routine-card.component.html",
  styleUrl: "./routine-card.component.scss",
  host: {
    class: "routine-card",
  },
})
export class RoutineCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() featured = false;
  @Input() badge: string | null = null;

  @HostBinding("class.routine-card--featured")
  get isFeatured(): boolean {
    return this.featured;
  }
}
