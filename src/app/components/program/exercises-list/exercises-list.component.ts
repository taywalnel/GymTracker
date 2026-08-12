import { Component, OnInit } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { Exercise } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";

@Component({
  selector: "app-exercises-list",
  imports: [ButtonComponent, RouterLink, RoutineCardComponent],
  templateUrl: "./exercises-list.component.html",
  styleUrl: "./exercises-list.component.scss",
})
export class ExercisesListComponent implements OnInit {
  exercises: Exercise[] = [];
  loading = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.loading = true;
    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = [...exercises].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
        this.loading = false;
      },
    });
  }

  createExercise(): void {
    this.router.navigate(["/program/exercises/new"]);
  }
}
