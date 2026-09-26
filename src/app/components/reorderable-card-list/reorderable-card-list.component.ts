import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
  inject,
} from "@angular/core";
import {
  CDK_DRAG_CONFIG,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  DragDropConfig,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

import { REORDER_SVG } from "../../constants/svg.constants";
import { ResolvedExercisePrescription } from "../../models/workout.models";
import { ButtonComponent } from "../button/button.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

const dragConfig: DragDropConfig = {
  dragStartThreshold: 0,
};

@Component({
  selector: "app-reorderable-card-list",
  imports: [
    ButtonComponent,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    RoutineCardComponent,
  ],
  templateUrl: "./reorderable-card-list.component.html",
  styleUrl: "./reorderable-card-list.component.scss",
  providers: [{ provide: CDK_DRAG_CONFIG, useValue: dragConfig }],
})
export class ReorderableCardListComponent {
  // Created once so the [innerHTML] binding is stable. A fresh SafeHtml per
  // change detection re-renders the SVG, detaching the touched node mid-drag,
  // which makes iOS stop delivering touchmove events to the CDK.
  readonly reorderIcon: SafeHtml =
    inject(DomSanitizer).bypassSecurityTrustHtml(REORDER_SVG);

  @Input({ required: true }) exercises: ResolvedExercisePrescription[] = [];
  @Input() disabled = false;
  @Input() deletable = false;
  // Grow to fill the remaining height of a flex column parent and scroll the
  // cards when they don't fit.
  @HostBinding("class.scroll-area") @Input() fill = false;
  @Output() reordered = new EventEmitter<ResolvedExercisePrescription[]>();
  @Output() exerciseSelected = new EventEmitter<string>();
  @Output() exerciseDeleted = new EventEmitter<string>();

  drop(event: CdkDragDrop<ResolvedExercisePrescription[]>): void {
    if (event.previousIndex === event.currentIndex) return;

    const exercises = [...this.exercises];
    moveItemInArray(exercises, event.previousIndex, event.currentIndex);
    this.reordered.emit(exercises);
  }

  selectExercise(exerciseId: string): void {
    this.exerciseSelected.emit(exerciseId);
  }

  deleteExercise(exerciseId: string): void {
    this.exerciseDeleted.emit(exerciseId);
  }
}
