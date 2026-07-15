import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";

import {
  ExercisePrescription,
  CompletedSet,
} from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { ButtonComponent } from "../button/button.component";
import { NavDotsComponent, NavDotItem } from "../nav-dots/nav-dots.component";
import { WorkoutProgressComponent } from "../workout-progress/workout-progress.component";

@Component({
  selector: "app-exercise-card",
  imports: [ButtonComponent, NavDotsComponent, WorkoutProgressComponent],
  templateUrl: "./exercise-card.component.html",
  styleUrl: "./exercise-card.component.scss",
})
export class ExerciseCardComponent implements OnInit, OnChanges {
  @Input({ required: true }) exercise!: ExercisePrescription;
  @Input() isCurrent = false;
  /** Previously saved sets to restore when navigating back to this exercise */
  @Input() savedSets: CompletedSet[] | null = null;

  /** Emits the updated set data every time the person edits a rep/weight value */
  @Output() setsChanged = new EventEmitter<CompletedSet[]>();
  /** Emits when the person marks this exercise as done for the session */
  @Output() markComplete = new EventEmitter<void>();

  /** Working sets, always stored internally in kg regardless of display unit. */
  workingSets: CompletedSet[] = [];

  /** Index of the set currently shown in the stepper. */
  activeSetIndex = 0;

  /** Set indices that have been marked complete. */
  completedSetIndices = new Set<number>();

  /** Whether each set's reps stepper has been "started" — controls 0-state vs target-prefill behavior */
  private setStarted: boolean[] = [];
  /** Whether each set's reps stepper has ever been touched — never resets to false */
  protected setTouched: boolean[] = [];

  readonly repStep = 1;

  constructor(
    public units: UnitPreferenceService,
    public restTimer: RestTimerService,
  ) {}

  ngOnInit(): void {
    this.initSets();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["exercise"]) {
      this.initSets();
    } else if (this.workingSets.length === 0) {
      this.initSets();
    }
  }

  private initSets(): void {
    if (this.savedSets && this.savedSets.length === this.exercise.targetSets) {
      this.workingSets = this.savedSets.map((s) => ({ ...s }));
      this.setStarted = this.savedSets.map((s) => s.reps > 0);
      this.setTouched = this.savedSets.map((s) => s.reps > 0);
      this.completedSetIndices = new Set(
        this.savedSets
          .map((s, i) => (s.reps > 0 ? i : -1))
          .filter((i) => i !== -1),
      );
      // Start on the first incomplete set, or the last set if all are done
      const firstIncomplete = this.workingSets.findIndex(
        (_, i) => !this.completedSetIndices.has(i),
      );
      this.activeSetIndex =
        firstIncomplete !== -1 ? firstIncomplete : this.workingSets.length - 1;
    } else {
      this.workingSets = Array.from(
        { length: this.exercise.targetSets },
        (_, i) => ({
          setNumber: i + 1,
          reps: 0,
          weightKg: this.exercise.targetWeightKg,
        }),
      );
      this.setStarted = Array.from(
        { length: this.exercise.targetSets },
        () => false,
      );
      this.setTouched = Array.from(
        { length: this.exercise.targetSets },
        () => false,
      );
      this.activeSetIndex = 0;
      this.completedSetIndices = new Set<number>();
    }
  }

  get setNavItems(): NavDotItem[] {
    return this.workingSets.map((set, i) => {
      const isComplete = this.completedSetIndices.has(i);
      return {
        id: i,
        isActive: this.activeSetIndex === i,
        isComplete,
        isShort: isComplete && set.reps < this.exercise.targetReps,
        label: isComplete ? set.reps : this.exercise.targetReps,
        ariaLabel:
          `Set ${set.setNumber}` + (isComplete ? `: ${set.reps} reps` : ""),
      };
    });
  }

  get completedSetCount(): number {
    return this.completedSetIndices.size;
  }

  navigateToSet(index: number): void {
    this.activeSetIndex = index;
  }

  completeCurrentSet(): void {
    const idx = this.activeSetIndex;
    // If the stepper was never touched, the displayed value is targetReps — persist that.
    if (!this.setTouched[idx]) {
      this.workingSets[idx] = {
        ...this.workingSets[idx],
        reps: this.exercise.targetReps,
      };
      this.setStarted[idx] = true;
    }

    this.completedSetIndices = new Set([...this.completedSetIndices, idx]);
    this.setsChanged.emit(this.workingSets);

    const total = this.workingSets.length;
    let advanced = false;
    for (let offset = 1; offset <= total; offset++) {
      const next = (this.activeSetIndex + offset) % total;
      if (!this.completedSetIndices.has(next)) {
        this.activeSetIndex = next;
        advanced = true;
        break;
      }
    }

    if (!advanced) {
      // All sets complete
      this.markComplete.emit();
      return;
    }

    this.restTimer.start();
  }

  /**
   * Stepping reps up from zero jumps straight to the target rep count (so a
   * single tap gets you to "I did what was planned"), then increments/decrements
   * by 1 from there. Stepping down from the target back to zero resets "started".
   */
  stepReps(setIndex: number, direction: 1 | -1): void {
    const current = this.workingSets[setIndex];
    let nextReps: number;

    if (!this.setStarted[setIndex]) {
      nextReps = Math.max(
        0,
        this.exercise.targetReps + direction * this.repStep,
      );
      this.setStarted[setIndex] = nextReps > 0;
    } else {
      nextReps = Math.max(0, current.reps + direction * this.repStep);
    }

    this.setTouched[setIndex] = true;
    this.workingSets[setIndex] = { ...current, reps: nextReps };
    this.setsChanged.emit(this.workingSets);
  }

  /** Formats a stored kg weight for display in whatever unit is currently active. */
  formatWeight(weightKg: number): string {
    return this.units.formatWeight(weightKg);
  }
}
