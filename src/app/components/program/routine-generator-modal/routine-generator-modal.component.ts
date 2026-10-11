import { Component, EventEmitter, Input, Output } from "@angular/core";
import { ROUTINE_MAX_MUSCLE_GROUPS } from "../../../models/routine-generation.models";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  MuscleGroup,
} from "../../../models/workout.models";
import { ButtonComponent } from "../../button/button.component";
import {
  ChoiceListComponent,
  ChoiceOption,
} from "../../choice-list/choice-list.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";

/** Picks muscle groups for an AI-built routine; the parent does the request. */
@Component({
  selector: "app-routine-generator-modal",
  imports: [ButtonComponent, ChoiceListComponent, LoadingSpinnerComponent],
  templateUrl: "./routine-generator-modal.component.html",
  styleUrl: "./routine-generator-modal.component.scss",
  host: {
    "(document:keydown.escape)": "close()",
  },
})
export class RoutineGeneratorModalComponent {
  @Input() isLoading = false;
  @Input() error: string | null = null;

  @Output() generate = new EventEmitter<MuscleGroup[]>();
  @Output() closed = new EventEmitter<void>();

  readonly maxGroups = ROUTINE_MAX_MUSCLE_GROUPS;
  readonly options: ChoiceOption<MuscleGroup>[] = MUSCLE_GROUPS.map(
    (group) => ({ value: group, label: MUSCLE_GROUP_LABELS[group] }),
  );
  groups: MuscleGroup[] = [];

  get tooManyGroups(): boolean {
    return this.groups.length > this.maxGroups;
  }

  get canGenerate(): boolean {
    return this.groups.length > 0 && !this.tooManyGroups && !this.isLoading;
  }

  submit(): void {
    if (this.canGenerate) this.generate.emit([...this.groups]);
  }

  close(): void {
    if (!this.isLoading) this.closed.emit();
  }
}
