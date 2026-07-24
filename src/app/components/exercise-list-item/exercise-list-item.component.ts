import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ButtonComponent } from "../button/button.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";

@Component({
  selector: "app-exercise-list-item",
  imports: [RouterLink, ButtonComponent, WeightAndRepsComponent],
  templateUrl: "./exercise-list-item.component.html",
  styleUrl: "./exercise-list-item.component.scss",
})
export class ExerciseListItemComponent {
  @Input() name = "";
  @Input() nameLink: string[] | null = null;
  /** Right-side meta text (e.g. weight). When showEditBtn is true, rendered as a subtitle instead. */
  @Input() meta: string | null = null;
  @Input() showEditBtn = false;
  @Input() weight: number | null = null;
  @Input() sets: WeightAndRepsSet[] | null = null;
}
