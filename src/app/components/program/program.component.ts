import { Component, OnInit } from "@angular/core";

import { Router } from "@angular/router";
import { WorkoutService } from "../../services/workout.service";
import { Routine } from "../../models/workout.models";
import { ButtonComponent } from "../button/button.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

@Component({
  selector: "app-program",
  imports: [ButtonComponent, PageHeaderComponent, RoutineCardComponent],
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

  editRoutine(routine: Routine): void {
    this.router.navigate(["/program/edit", routine.id]);
  }

  createRoutine(): void {
    this.router.navigate(["/program/edit"]);
  }
}
