import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { NavDotsComponent, NavDotItem } from "../nav-dots/nav-dots.component";
import { ButtonComponent } from "../button/button.component";

@Component({
  selector: "app-exercise-list-item",
  standalone: true,
  imports: [RouterLink, NavDotsComponent, ButtonComponent],
  templateUrl: "./exercise-list-item.component.html",
  styleUrl: "./exercise-list-item.component.scss",
})
export class ExerciseListItemComponent {
  @Input() name = "";
  @Input() nameLink: string[] | null = null;
  /** Right-side meta text (e.g. weight). When showEditBtn is true, rendered as a subtitle instead. */
  @Input() meta: string | null = null;
  @Input() showEditBtn = false;
  @Input() navDots: NavDotItem[] | null = null;
  @Input() navDotsLayout: "packed" | "spread" = "packed";
}
