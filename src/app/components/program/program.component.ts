import { Component, OnInit } from "@angular/core";

import { Router } from "@angular/router";
import { WorkoutService } from "../../services/workout.service";
import { Routine } from "../../models/workout.models";
import { ButtonComponent } from "../button/button.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import { EditableCardComponent } from "../editable-card/editable-card.component";
import { PageHeaderComponent } from "../page-header/page-header.component";

@Component({
  selector: "app-program",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    EditableCardComponent,
    PageHeaderComponent,
  ],
  templateUrl: "./program.component.html",
  styleUrl: "./program.component.scss",
})
export class ProgramComponent implements OnInit {
  routines: Routine[] = [];
  loading = false;
  routinePendingDeletion: Routine | null = null;

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

  editRoutine(routine: Routine): void {
    this.router.navigate(["/program/edit", routine.id]);
  }

  deleteRoutine(routine: Routine): void {
    this.routinePendingDeletion = routine;
  }

  cancelDelete(): void {
    this.routinePendingDeletion = null;
  }

  confirmDelete(): void {
    const routine = this.routinePendingDeletion;
    if (!routine) return;

    this.workoutService.deleteRoutine(routine.id).subscribe({
      next: () => {
        this.routines = this.routines.filter((item) => item.id !== routine.id);
        this.routinePendingDeletion = null;
      },
      error: () => alert("Error deleting routine"),
    });
  }

  createRoutine(): void {
    this.router.navigate(["/program/edit"]);
  }
}
