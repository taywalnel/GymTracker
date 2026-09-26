import { Component, ElementRef, Input, inject } from "@angular/core";

// The app's list row. Use <a app-card [routerLink]> for navigation and
// <app-card (click)> for actions; both get keyboard support. Anything
// projected inside is shown at the trailing edge (status dots, actions).
@Component({
  selector: "app-card, a[app-card]",
  templateUrl: "./routine-card.component.html",
  styleUrl: "./routine-card.component.scss",
  host: {
    class: "card routine-card",
    "[class.routine-card--interactive]": "interactive",
    "[class.routine-card--featured]": "featured",
    "[class.card--highlight]": "featured || highlighted",
    "[attr.role]": "interactive && !isLink ? 'button' : null",
    "[attr.tabindex]": "interactive && !isLink ? 0 : null",
    "(keydown.enter)": "activate($event)",
    "(keydown.space)": "activate($event)",
  },
})
export class RoutineCardComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly isLink = this.host.nativeElement.tagName === "A";

  @Input({ required: true }) title!: string;
  @Input({ required: false }) description: string | null = null;
  // Larger, highlighted card for the primary choice on a screen.
  @Input() featured = false;
  // Highlight without enlarging, e.g. the exercise currently in progress.
  @Input() highlighted = false;
  @Input() badge: string | null = null;
  @Input() showChevron = false;
  // Set false for rows that only display data or hold their own buttons.
  @Input() interactive = true;

  activate(event: Event): void {
    // Links already activate on Enter; a div with role="button" needs both keys.
    if (
      !this.interactive ||
      this.isLink ||
      event.target !== this.host.nativeElement
    ) {
      return;
    }
    event.preventDefault();
    this.host.nativeElement.click();
  }
}
