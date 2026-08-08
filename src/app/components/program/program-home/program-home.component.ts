import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import { WorkoutService } from "../../../services/workout.service";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";

@Component({
  selector: "app-program-home",
  imports: [
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RouterLink,
    RoutineCardComponent,
  ],
  templateUrl: "./program-home.component.html",
  styleUrl: "./program-home.component.scss",
})
export class ProgramHomeComponent implements OnInit {
  isLoading = true;
  workoutCount = 0;
  exerciseCount = 0;

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    forkJoin({
      routines: this.workoutService.getAllRoutines(),
      exerciseCount: this.workoutService.getExerciseCount(),
    }).subscribe({
      next: ({ routines, exerciseCount }) => {
        this.workoutCount = routines.length;
        this.exerciseCount = exerciseCount;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }
}
