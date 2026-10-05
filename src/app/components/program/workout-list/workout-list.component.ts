import { Component, Input, OnInit, inject } from "@angular/core";
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

import { Router } from "@angular/router";
import { REORDER_SVG } from "../../../constants/svg.constants";
import { WorkoutService } from "../../../services/workout.service";
import { Routine, isRoutineActive } from "../../../models/workout.models";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";
import { ButtonComponent } from "../../button/button.component";
import { EmptyStateComponent } from "../../empty-state/empty-state.component";

type RoutineSectionId = "rotation" | "library";

const dragConfig: DragDropConfig = {
  dragStartThreshold: 0,
};

@Component({
  selector: "app-workout-list",
  imports: [
    ButtonComponent,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    EmptyStateComponent,
    RoutineCardComponent,
  ],
  templateUrl: "./workout-list.component.html",
  styleUrl: "./workout-list.component.scss",
  providers: [{ provide: CDK_DRAG_CONFIG, useValue: dragConfig }],
})
export class WorkoutListComponent implements OnInit {
  // Created once so the [innerHTML] binding is stable mid-drag on iOS; see
  // ReorderableCardListComponent.
  readonly reorderIcon: SafeHtml =
    inject(DomSanitizer).bypassSecurityTrustHtml(REORDER_SVG);

  /** Shows drag handles and rotation toggles in place of navigation. */
  @Input() editing = false;

  routines: Routine[] = [];
  loading = false;

  get rotationRoutines(): Routine[] {
    return this.routines.filter(isRoutineActive);
  }

  get libraryRoutines(): Routine[] {
    return this.routines.filter((routine) => !isRoutineActive(routine));
  }

  get sections(): {
    id: RoutineSectionId;
    label: string;
    routines: Routine[];
  }[] {
    return [
      { id: "rotation", label: "In rotation", routines: this.rotationRoutines },
      { id: "library", label: "Library", routines: this.libraryRoutines },
    ];
  }

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadRoutines();
  }

  loadRoutines(): void {
    this.loading = true;
    this.workoutService.getAllRoutines().subscribe({
      next: (routines) => {
        this.routines = routines;
        this.loading = false;
      },
    });
  }

  createRoutine(): void {
    this.router.navigate(["/program/workout/new"]);
  }

  viewRoutine(routine: Routine): void {
    if (this.editing) return;
    this.router.navigate(["/program/workout", routine.id]);
  }

  drop(section: RoutineSectionId, event: CdkDragDrop<unknown>): void {
    const rotation = this.rotationRoutines;
    const library = this.libraryRoutines;
    moveItemInArray(
      section === "rotation" ? rotation : library,
      event.previousIndex,
      event.currentIndex,
    );
    this.saveOrder(rotation, library);
  }

  /** Moves a routine to the end of the other section. */
  toggleActive(routine: Routine): void {
    const active = !isRoutineActive(routine);
    const moved = { ...routine, active };
    const rotation = this.rotationRoutines.filter((r) => r.id !== routine.id);
    const library = this.libraryRoutines.filter((r) => r.id !== routine.id);
    if (active) {
      rotation.push(moved);
    } else {
      library.push(moved);
    }
    this.saveOrder(rotation, library);
  }

  private saveOrder(rotation: Routine[], library: Routine[]): void {
    const previous = this.routines;
    const routines = [...rotation, ...library].map((routine, index) => ({
      ...routine,
      rotationOrder: index,
    }));
    if (
      routines.every(
        (routine, index) =>
          routine.id === previous[index]?.id &&
          routine.active === previous[index].active,
      )
    ) {
      return;
    }

    this.routines = routines;
    this.workoutService.saveRoutineOrder(routines).subscribe({
      error: () => {
        this.routines = previous;
      },
    });
  }
}
