import { Component, HostBinding, Input } from "@angular/core";

@Component({
  selector: "app-card",
  templateUrl: "./routine-card.component.html",
  styleUrl: "./routine-card.component.scss",
  host: {
    class: "routine-card",
  },
})
export class RoutineCardComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: false }) description: string | null = null;
  @Input() featured = false;
  @Input() showFeaturedBorder = true;
  @Input() badge: string | null = null;
  @Input() showChevron = false;

  @HostBinding("class.routine-card--featured")
  get isFeatured(): boolean {
    return this.featured;
  }

  @HostBinding("class.routine-card--no-featured-border")
  get hasNoFeaturedBorder(): boolean {
    return this.featured && !this.showFeaturedBorder;
  }
}
