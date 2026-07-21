import { Component } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { RestTimerService } from "./services/rest-timer.service";
import { ButtonComponent } from "./components/button/button.component";
import { TabService } from "./services/tab.service";
import { WorkoutService } from "./services/workout.service";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  constructor(
    public restTimer: RestTimerService,
    private router: Router,
    private tabService: TabService,
    private workoutService: WorkoutService,
  ) {}

  onTodayTabClick(event: MouseEvent): void {
    // If we're already on the Today route, prevent default navigation and broadcast the click
    const url = this.router.url || "/";
    if (url === "/" || url === "") {
      event.preventDefault();
      this.tabService.notifyTodayClick();
    }
    // otherwise allow the routerLink to navigate normally
  }

  isTodayRoute(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path === "/" || path.startsWith("/current-workout/");
  }

  isCurrentExerciseRoute(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return /^\/current-workout\/[^/]+\/[^/]+$/.test(path);
  }

  returnToCurrentExercise(): void {
    const state = this.workoutService.getInProgressState();
    if (!state) return;

    const exerciseId =
      state.activeExerciseId ??
      state.today.routine.exercises.find(
        (exercise) => !state.completedExerciseIds.includes(exercise.id),
      )?.id;
    if (!exerciseId) return;

    this.router.navigate([
      "/current-workout",
      state.today.routine.id,
      exerciseId,
    ]);
  }
}
