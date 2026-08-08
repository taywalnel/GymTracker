import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
  SimpleChanges,
  inject,
} from "@angular/core";
import { Router } from "@angular/router";

import {
  ResolvedExercisePrescription,
  CompletedSet,
  ExerciseLog,
} from "../../models/workout.models";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { WorkoutService } from "../../services/workout.service";
import { ButtonComponent } from "../button/button.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
} from "../weight-and-reps/weight-and-reps.component";
import { StepperComponent } from "../stepper/stepper.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

@Component({
  selector: "app-exercise-card",
  imports: [
    ButtonComponent,
    PageHeaderComponent,
    WeightAndRepsComponent,
    StepperComponent,
    ConfirmationModalComponent,
  ],
  templateUrl: "./exercise-card.component.html",
  styleUrl: "./exercise-card.component.scss",
})
export class ExerciseCardComponent implements OnInit, OnChanges {
  @Input({ required: true }) exercise!: ResolvedExercisePrescription;
  @Input() isCurrent = false;
  @Input() progressionSuggestionAlreadyShown = false;
  /** Previously saved sets to restore when navigating back to this exercise */
  @Input() savedSets: CompletedSet[] | null = null;

  /** Emits the updated set data every time the person edits a rep/weight value */
  @Output() setsChanged = new EventEmitter<CompletedSet[]>();
  /** Emits when the person marks this exercise as done for the session */
  @Output() markComplete = new EventEmitter<void>();
  /** Emits when the person returns to the workout overview. */
  @Output() back = new EventEmitter<void>();
  /** Emits when the person wants to adjust a prescription after consistent success. */
  @Output() adjustRoutineRequested = new EventEmitter<void>();
  /** Emits when the progressive-overload suggestion first becomes visible. */
  @Output() progressionSuggestionShown = new EventEmitter<void>();

  /** Working sets, always stored internally in kg regardless of display unit. */
  workingSets: CompletedSet[] = [];

  /** Index of the set currently shown in the stepper. */
  activeSetIndex = 0;

  /** The most recent completed history entry for this exercise, if any. */
  lastHistoryEntry: ExerciseHistoryEntry | null = null;

  /** Whether the progressive-overload suggestion is open. */
  showProgressionSuggestion = false;

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
    private router: Router,
    private workoutService: WorkoutService,
  ) {}

  ngOnInit(): void {
    this.initSets();
    this.loadExerciseHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["exercise"]) {
      this.initSets();
      this.loadExerciseHistory();
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

  get completedSetCount(): number {
    return this.completedSetIndices.size;
  }

  get restTimerProgress(): number {
    const secondsLeft = this.restTimer.secondsLeft;
    return secondsLeft === null
      ? 0
      : (secondsLeft / this.restTimer.duration) * 100;
  }

  get targetSetReps(): WeightAndRepsSet[] {
    return Array.from({ length: this.exercise.targetSets }, () => ({
      targetAmount: this.exercise.targetReps,
    }));
  }

  get currentWeightKg(): number {
    return this.workingSets[0]?.weightKg ?? this.exercise.targetWeightKg;
  }

  get activeSetDefaultReps(): number {
    if (this.setTouched[this.activeSetIndex]) {
      return this.workingSets[this.activeSetIndex].reps;
    }

    const previousCompletedSet = [...this.completedSetIndices]
      .sort((a, b) => b - a)
      .map((index) => this.workingSets[index])
      .find((set) => set !== undefined);

    return previousCompletedSet?.reps ?? this.exercise.targetReps;
  }

  get currentSetReps(): WeightAndRepsSet[] {
    return Array.from({ length: this.exercise.targetSets }, (_, index) => {
      const set = this.workingSets[index];
      const isComplete = this.completedSetIndices.has(index);

      return {
        targetAmount: this.exercise.targetReps,
        achievedAmount: isComplete ? set!.reps : undefined,
      };
    });
  }

  private loadExerciseHistory(): void {
    this.lastHistoryEntry = null;
    this.workoutService
      .getExerciseHistory(this.exercise.id)
      .subscribe((entries) => {
        this.lastHistoryEntry =
          entries.find((entry) => entry.log.completedSets.length > 0) ?? null;
        const shouldShowSuggestion =
          this.hasEarnedProgressionSuggestion(entries);
        this.showProgressionSuggestion = shouldShowSuggestion;
        if (shouldShowSuggestion) {
          this.progressionSuggestionShown.emit();
        }
      });
  }

  private hasEarnedProgressionSuggestion(
    entries: ExerciseHistoryEntry[],
  ): boolean {
    const completedEntries = entries.filter(
      (entry) => entry.log.completedSets?.length > 0,
    );

    if (
      !this.isCurrent ||
      this.progressionSuggestionAlreadyShown ||
      completedEntries.length < 3
    ) {
      return false;
    }

    const recentLogs = completedEntries.slice(0, 3).map(({ log }) => log);
    const firstSets = recentLogs[0].completedSets;

    if (
      firstSets.length !== this.exercise.targetSets ||
      firstSets.some(
        (set) =>
          set.weightKg !== this.exercise.targetWeightKg ||
          set.reps < this.exercise.targetReps,
      )
    ) {
      return false;
    }

    return recentLogs.slice(1).every((log) => {
      const sets = log.completedSets;
      return (
        sets.length === firstSets.length &&
        sets.every(
          (set, index) =>
            set.reps === firstSets[index].reps &&
            set.weightKg === firstSets[index].weightKg,
        )
      );
    });
  }

  toWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
    return log.completedSets.map((set) => ({
      targetAmount: log.targetReps ?? set.reps,
      achievedAmount: log.targetReps === undefined ? undefined : set.reps,
    }));
  }

  navigateToSet(index: number): void {
    if (
      index > this.activeSetIndex &&
      !Array.from({ length: index }, (_, setIndex) => setIndex).every(
        (setIndex) => this.completedSetIndices.has(setIndex),
      )
    ) {
      return;
    }

    this.activeSetIndex = index;
  }

  completeCurrentSet(): void {
    const idx = this.activeSetIndex;
    const wasAlreadyComplete = this.completedSetIndices.has(idx);
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

    if (wasAlreadyComplete) {
      this.activeSetIndex = (idx + 1) % this.workingSets.length;
      return;
    }

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

  skipRestTimer(): void {
    this.restTimer.clear();
  }

  viewExerciseHistory(): void {
    this.router.navigate(["/history/exercises", this.exercise.id]);
  }

  dismissProgressionSuggestion(): void {
    this.showProgressionSuggestion = false;
  }

  adjustRoutine(): void {
    this.showProgressionSuggestion = false;
    this.adjustRoutineRequested.emit();
  }

  /**
   * Stepping reps up from zero jumps straight to the target rep count (so a
   * single tap gets you to "I did what was planned"), then increments/decrements
   * by 1 from there. Stepping down from the target back to zero resets "started".
   */
  stepReps(setIndex: number, nextReps: number): void {
    const current = this.workingSets[setIndex];
    this.setStarted[setIndex] = nextReps > 0;
    this.setTouched[setIndex] = true;
    this.workingSets[setIndex] = { ...current, reps: Math.max(0, nextReps) };
    this.setsChanged.emit(this.workingSets);
  }

  /** Formats a stored kg weight for display in whatever unit is currently active. */
  formatWeight(weightKg: number): string {
    return this.units.formatWeight(weightKg);
  }
}
