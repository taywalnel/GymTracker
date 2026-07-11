import {
  Component,
  EventEmitter,
  HostBinding,
  HostListener,
  Input,
  Output,
} from "@angular/core";
import { Routine } from "../../models/workout.models";

@Component({
  selector: "app-routine-card, li[app-routine-card]",
  templateUrl: "./routine-card.component.html",
  styleUrl: "./routine-card.component.scss",
  host: {
    class: "routine-card",
    role: "button",
    tabindex: "0",
  },
})
export class RoutineCardComponent {
  @Input({ required: true }) routine!: Routine;
  @Input() featured = false;
  @Input() badge: string | null = null;
  @Input() showEditButton = false;
  @Input() showDeleteButton = false;
  @Output() selected = new EventEmitter<Routine>();
  @Output() editRequested = new EventEmitter<Routine>();
  @Output() deleteRequested = new EventEmitter<Routine>();

  @HostBinding("class.routine-card--featured")
  get isFeatured(): boolean {
    return this.featured;
  }

  @HostBinding("attr.aria-label")
  get ariaLabel(): string {
    return `Select ${this.routine.name}`;
  }

  @HostListener("click")
  select(): void {
    this.selected.emit(this.routine);
  }

  @HostListener("keydown.enter", ["$event"])
  @HostListener("keydown.space", ["$event"])
  onKeyboardSelect(event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    this.select();
  }

  requestEdit(event: Event): void {
    event.stopPropagation();
    this.editRequested.emit(this.routine);
  }

  requestDelete(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.routine);
  }
}
