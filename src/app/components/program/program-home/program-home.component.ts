import { Component, OnInit } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { forkJoin } from "rxjs";
import { WorkoutService } from "../../../services/workout.service";
import { ExercisesListComponent } from "../exercises-list/exercises-list.component";
import { WorkoutListComponent } from "../workout-list/workout-list.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../../page-header/page-header.component";

@Component({
  selector: "app-program-home",
  imports: [ExercisesListComponent, PageHeaderComponent, WorkoutListComponent],
  templateUrl: "./program-home.component.html",
  styleUrl: "./program-home.component.scss",
})
export class ProgramHomeComponent implements OnInit {
  activeTab = "Routines";
  routineCount = 0;
  exerciseCount = 0;

  get programTabs(): PageHeaderTab[] {
    return [
      { label: "Routines", count: this.routineCount },
      { label: "Exercises", count: this.exerciseCount },
    ];
  }

  constructor(
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.queryParamMap.get("tab");
    if (requestedTab === "Exercises" || requestedTab === "Routines") {
      this.activeTab = requestedTab;
    }

    forkJoin({
      routines: this.workoutService.getAllRoutines(),
      exercises: this.workoutService.getAllExercises(),
    }).subscribe(({ routines, exercises }) => {
      this.routineCount = routines.length;
      this.exerciseCount = exercises.length;
    });
  }

  selectTab(tab: string): void {
    this.activeTab = tab;
  }
}
