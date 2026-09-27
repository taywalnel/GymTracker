import { Component, HostListener, signal } from "@angular/core";
import { SwUpdate, VersionReadyEvent } from "@angular/service-worker";
import { filter } from "rxjs";
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
  /** Firestore queues writes while offline; this tells the user they'll sync. */
  readonly isOffline = signal(!navigator.onLine);

  @HostListener("window:online")
  onOnline(): void {
    this.isOffline.set(false);
  }

  @HostListener("window:offline")
  onOffline(): void {
    this.isOffline.set(true);
  }

  /** A new deploy has downloaded and will load on the next reload. */
  readonly updateReady = signal(false);

  // Installed apps are usually resumed rather than reloaded, so check for a
  // new version whenever the app comes back to the foreground.
  @HostListener("document:visibilitychange")
  onVisibilityChange(): void {
    if (document.visibilityState === "visible" && this.swUpdate.isEnabled) {
      void this.swUpdate.checkForUpdate().catch(() => undefined);
    }
  }

  constructor(
    private router: Router,
    private tabService: TabService,
    private workoutService: WorkoutService,
    private swUpdate: SwUpdate,
  ) {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates
      .pipe(
        filter(
          (event): event is VersionReadyEvent => event.type === "VERSION_READY",
        ),
      )
      .subscribe(() => this.updateReady.set(true));
    // The cached app is broken (e.g. files evicted); only a reload recovers.
    this.swUpdate.unrecoverable.subscribe(() => document.location.reload());
  }

  /** Reloading mid-workout is safe, but the prompt waits so it isn't a distraction. */
  showUpdatePrompt(): boolean {
    return this.updateReady() && !this.workoutService.getInProgressState();
  }

  reloadForUpdate(): void {
    document.location.reload();
  }

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
