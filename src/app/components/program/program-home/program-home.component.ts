import { Component } from "@angular/core";
import { ExercisesListComponent } from "../exercises-list/exercises-list.component";
import { WorkoutListComponent } from "../workout-list/workout-list.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";

@Component({
  selector: "app-program-home",
  imports: [ExercisesListComponent, PageHeaderComponent, WorkoutListComponent],
  templateUrl: "./program-home.component.html",
  styleUrl: "./program-home.component.scss",
})
export class ProgramHomeComponent {
  activeTab = "Routines";

  selectTab(tab: string): void {
    this.activeTab = tab;
  }
}
