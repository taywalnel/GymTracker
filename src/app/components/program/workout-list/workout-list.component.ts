import { Component, OnInit } from "@angular/core";

import { Router } from "@angular/router";
import { WorkoutService } from "../../../services/workout.service";
import { Routine } from "../../../models/workout.models";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { EditableCardComponent } from "../../editable-card/editable-card.component";

@Component({
  selector: "app-workout-list",
  imports: [ButtonComponent, ConfirmationModalComponent, EditableCardComponent],
  templateUrl: "./workout-list.component.html",
  styleUrl: "./workout-list.component.scss",
})
export class WorkoutListComponent implements OnInit {
  routines: Routine[] = [];
  loading = false;
  pendingDeleteRoutine: Routine | null = null;

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

  viewRoutine(routine: Routine): void {
    this.router.navigate(["/program/workout/edit", routine.id]);
  }

  deleteRoutine(routine: Routine): void {
    this.pendingDeleteRoutine = routine;
  }

  cancelDelete(): void {
    this.pendingDeleteRoutine = null;
  }

  confirmDelete(): void {
    const routine = this.pendingDeleteRoutine;
    if (!routine) return;

    this.loading = true;
    this.workoutService.deleteRoutine(routine.id).subscribe({
      next: () => {
        this.routines = this.routines.filter((item) => item.id !== routine.id);
        this.pendingDeleteRoutine = null;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  createRoutine(): void {
    this.router.navigate(["/program/workout/edit"]);
  }
}
