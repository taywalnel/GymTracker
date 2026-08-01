import { Component, OnInit } from "@angular/core";
import { Exercise } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { EditableCardComponent } from "../../editable-card/editable-card.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { RoutineCardComponent } from "../../routine-card/routine-card.component";

@Component({
  selector: "app-exercises-list",
  imports: [RoutineCardComponent, PageHeaderComponent],
  templateUrl: "./exercises-list.component.html",
  styleUrl: "./exercises-list.component.scss",
})
export class ExercisesListComponent implements OnInit {
  exercises: Exercise[] = [];
  loading = false;

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.loading = true;
    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = exercises;
        this.loading = false;
      },
    });
  }
}
