import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ButtonComponent } from "../button/button.component";
import {
  SetStripComponent,
  SetStripSet,
} from "../set-strip/set-strip.component";

@Component({
  selector: "app-exercise-list-item",
  imports: [RouterLink, ButtonComponent, SetStripComponent],
  templateUrl: "./exercise-list-item.component.html",
  styleUrl: "./exercise-list-item.component.scss",
  host: { class: "card" },
})
export class ExerciseListItemComponent {
  @Input() name = "";
  @Input() nameLink: string[] | null = null;
  /** Right-side meta text (e.g. weight). When showEditBtn is true, rendered as a subtitle instead. */
  @Input() meta: string | null = null;
  @Input() showEditBtn = false;
  @Input() weight: number | null = null;
  @Input() sets: SetStripSet[] | null = null;

  /** The sets, with the exercise's weight for any set without its own. */
  get stripSets(): SetStripSet[] {
    return (this.sets ?? []).map((set) => ({
      ...set,
      weightKg: set.weightKg ?? this.weight ?? undefined,
    }));
  }
}
