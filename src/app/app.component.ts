import { Component } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
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
    private router: Router,
    private tabService: TabService,
    private workoutService: WorkoutService,
  ) {}

  onTodayTabClick(event: MouseEvent): void {
    const saved = this.workoutService.getInProgressState();
    if (saved) {
      event.preventDefault();
      const route = ["/current-workout", saved.today.routine.id];
      if (saved.activeExerciseId) route.push(saved.activeExerciseId);
      this.router.navigate(route);
      return;
    }

    // If we're already on the Today route, prevent default navigation and broadcast the click
    const url = this.router.url || "/";
    if (url === "/" || url === "") {
      event.preventDefault();
      this.tabService.notifyTodayClick();
    }
    // otherwise allow the routerLink to navigate normally
  }

  // Signed-out screens have nowhere to navigate to, so they get no tab bar.
  showTabBar(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path !== "/login";
  }

  isTodayRoute(): boolean {
    const path = this.router.url.split(/[?#]/, 1)[0];
    return path === "/" || path.startsWith("/current-workout/");
  }
}
