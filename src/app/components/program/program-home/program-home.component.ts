import { Component, OnInit } from "@angular/core";
import { RouterLink } from "@angular/router";
import { WorkoutService } from "../../../services/workout.service";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";

@Component({
  selector: "app-program-home",
  imports: [PageHeaderComponent, RouterLink, RoutineCardComponent],
  templateUrl: "./program-home.component.html",
  styleUrl: "./program-home.component.scss",
})
export class ProgramHomeComponent implements OnInit {
  workoutCount = 0;
  exerciseCount = 0;

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.workoutService.getAllRoutines().subscribe({
      next: (routines) => (this.workoutCount = routines.length),
    });
    this.workoutService.getExerciseCount().subscribe({
      next: (count) => (this.exerciseCount = count),
    });
  }

  pluralize(count: number, noun: string): string {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }
}
