import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { WorkoutSession, ExerciseLog } from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { NavDotItem } from "../nav-dots/nav-dots.component";
import { ExerciseListItemComponent } from "../exercise-list-item/exercise-list-item.component";

interface ExerciseDisplay {
  log: ExerciseLog;
  dots: NavDotItem[];
}

@Component({
  selector: "app-session-detail",
  standalone: true,
  imports: [CommonModule, RouterLink, ExerciseListItemComponent],
  templateUrl: "./session-detail.component.html",
  styleUrl: "./session-detail.component.scss",
})
export class SessionDetailComponent implements OnInit {
  session: WorkoutSession | null = null;
  exercises: ExerciseDisplay[] = [];
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get("sessionId") ?? "";
    this.workoutService.getSessionById(sessionId).subscribe((session) => {
      this.session = session;

      if (session) {
        this.exercises = session.exerciseLogs
          .filter((log) => log.completedSets.length > 0)
          .map((log) => ({
            log,
            dots: log.completedSets.map((set) => ({
              id: set.setNumber,
              isActive: false,
              isComplete: true,
              isShort:
                log.targetReps !== undefined && set.reps < log.targetReps,
              label: set.reps,
              ariaLabel: `Set ${set.setNumber}: ${set.reps} reps`,
            })),
          }));
      }
      this.isLoading = false;
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  formatWeight(log: ExerciseLog): string {
    if (!log.completedSets.length || log.completedSets[0].weightKg === 0)
      return "";
    return (
      this.units.formatWeight(log.completedSets[0].weightKg) +
      " " +
      this.units.unitLabel()
    );
  }
}
