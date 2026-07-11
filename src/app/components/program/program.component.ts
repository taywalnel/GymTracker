import { Component, OnInit } from "@angular/core";

import { Router, RouterLink } from "@angular/router";
import { WorkoutService } from "../../services/workout.service";
import { Routine } from "../../models/workout.models";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

@Component({
  selector: "app-program",
  imports: [RouterLink, RoutineCardComponent],
  templateUrl: "./program.component.html",
  styleUrl: "./program.component.scss",
})
export class ProgramComponent implements OnInit {
  routines: Routine[] = [];
  loading = false;

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

  deleteRoutine(id: string): void {
    if (confirm("Are you sure you want to delete this routine?")) {
      this.workoutService.deleteRoutine(id).subscribe({
        next: () => {
          this.loadRoutines();
        },
      });
    }
  }

  editRoutine(routine: Routine): void {
    this.router.navigate(["/program/edit", routine.id]);
  }
}
