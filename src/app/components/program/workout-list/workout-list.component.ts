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
  activeRoutines: Routine[] = [];
  inactiveRoutines: Routine[] = [];
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
        this.activeRoutines = routines.filter((routine) => routine.active);
        this.inactiveRoutines = routines.filter((routine) => !routine.active);
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

  setRoutineActive(routine: Routine, active: boolean): void {
    const previousActive = routine.active;
    routine.active = active;
    this.updateRoutineGroups();

    this.workoutService.saveRoutine(routine).subscribe({
      error: () => {
        routine.active = previousActive;
        this.updateRoutineGroups();
      },
    });
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
        this.activeRoutines = this.activeRoutines.filter(
          (item) => item.id !== routine.id,
        );
        this.inactiveRoutines = this.inactiveRoutines.filter(
          (item) => item.id !== routine.id,
        );
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

  private updateRoutineGroups(): void {
    this.activeRoutines = this.routines.filter((routine) => routine.active);
    this.inactiveRoutines = this.routines.filter((routine) => !routine.active);
  }
}
