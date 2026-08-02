import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { ResolvedExercisePrescription } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../../weight-and-reps/weight-and-reps.component";

@Component({
  selector: "app-workout-view",
  imports: [PageHeaderComponent, WeightAndRepsComponent],
  templateUrl: "./workout-view.component.html",
  styleUrl: "./workout-view.component.scss",
})
export class WorkoutViewComponent implements OnInit {
  workoutId: string | null = null;
  workoutName = "";
  exercises: ResolvedExercisePrescription[] = [];
  isLoading = true;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    this.workoutId = this.route.snapshot.paramMap.get("workoutId");
    if (!this.workoutId) return;

    this.workoutService.getRoutineById(this.workoutId).subscribe({
      next: (routine) => {
        this.workoutName = routine?.name ?? "";
        this.exercises =
          routine?.exercises
            .slice()
            .sort((left, right) => left.order - right.order) ?? [];
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  targetSets(exercise: ResolvedExercisePrescription): WeightAndRepsSet[] {
    return Array.from({ length: exercise.targetSets }, () => ({
      value: exercise.targetReps,
    }));
  }

  editWorkout(): void {
    if (!this.workoutId) return;
    this.router.navigate(["/program/workout/edit", this.workoutId]);
  }
}
