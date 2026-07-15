import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Routine } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { ButtonComponent } from "../button/button.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";

@Component({
  selector: "app-today-workout",
  imports: [ButtonComponent, RoutineCardComponent],
  templateUrl: "./today-workout.component.html",
  styleUrl: "./today-workout.component.scss",
})
export class TodayWorkoutComponent implements OnInit {
  isLoading = true;
  noRoutines = false;

  /** All routines shown in the picker, null while loading */
  allRoutines: Routine[] = [];
  /** The routine that would be next in rotation */
  nextRoutineId: string | null = null;
  get featuredRoutine(): Routine | null {
    return this.allRoutines.find((r) => r.id === this.nextRoutineId) ?? null;
  }

  get otherRoutines(): Routine[] {
    // If there's an in-progress saved session, exclude that routine from the "other" list.
    // Otherwise, exclude the featured (next) routine.
    const saved = this.savedState ?? this.workoutService.getInProgressState();
    const excludeId =
      saved && saved.today && saved.today.routine?.id
        ? saved.today.routine.id
        : this.nextRoutineId;
    if (!excludeId) return this.allRoutines.slice();
    return this.allRoutines.filter((r) => r.id !== excludeId);
  }

  todayDateLabel = "";
  savedState = this.workoutService.getInProgressState();

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.todayDateLabel = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
    this.loadToday();
  }

  private loadToday(): void {
    this.isLoading = true;
    this.noRoutines = false;
    this.workoutService.getRoutinesWithNext().subscribe({
      next: ({ routines, nextRoutineId }) => {
        this.allRoutines = routines;
        this.nextRoutineId = nextRoutineId;
        this.isLoading = false;
      },
      error: (err: Error) => {
        this.isLoading = false;
        if (err?.message === "No routines found") {
          this.noRoutines = true;
        }
      },
    });
  }

  selectRoutine(routine: Routine): void {
    this.isLoading = true;
    this.workoutService.getWorkoutForRoutine(routine.id).subscribe({
      next: (today) => {
        this.isLoading = false;
        this.workoutService.saveInProgressState({
          today,
          startedAt: Date.now(),
          completedExerciseIds: [],
          activeExerciseId: null,
          workingSets: [],
        });
        this.savedState = this.workoutService.getInProgressState();
        this.router.navigate(["/current-workout", routine.id]);
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  resumeSaved(): void {
    const saved = this.workoutService.getInProgressState();
    if (!saved) return;
    this.router.navigate(["/current-workout", saved.today.routine.id]);
  }

  discardSaved(): void {
    this.workoutService.clearInProgressState();
    this.savedState = null;
  }
}
