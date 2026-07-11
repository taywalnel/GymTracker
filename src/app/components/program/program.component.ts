import { Component, OnInit } from "@angular/core";

import { RouterLink } from "@angular/router";
import { WorkoutService } from "../../services/workout.service";
import { Routine } from "../../models/workout.models";

@Component({
    selector: "app-program",
    imports: [RouterLink],
    templateUrl: "./program.component.html",
    styleUrl: "./program.component.scss"
})
export class ProgramComponent implements OnInit {
  routines: Routine[] = [];
  loading = false;

  constructor(private workoutService: WorkoutService) {}

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

  deleteRoutine(id: string): void {
    if (confirm("Are you sure you want to delete this routine?")) {
      this.workoutService.deleteRoutine(id).subscribe({
        next: () => {
          this.loadRoutines();
        },
      });
    }
  }
}
