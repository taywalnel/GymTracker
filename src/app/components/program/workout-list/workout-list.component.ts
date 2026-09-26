import { Component, OnInit } from "@angular/core";

import { Router } from "@angular/router";
import { WorkoutService } from "../../../services/workout.service";
import { Routine } from "../../../models/workout.models";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";
import { ButtonComponent } from "../../button/button.component";
import { EmptyStateComponent } from "../../empty-state/empty-state.component";

@Component({
  selector: "app-workout-list",
  imports: [ButtonComponent, EmptyStateComponent, RoutineCardComponent],
  templateUrl: "./workout-list.component.html",
  styleUrl: "./workout-list.component.scss",
})
export class WorkoutListComponent implements OnInit {
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

  createRoutine(): void {
    this.router.navigate(["/program/workout/new"]);
  }

  viewRoutine(routine: Routine): void {
    this.router.navigate(["/program/workout", routine.id]);
  }
}
