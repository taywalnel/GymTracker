import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CompletedSet,
  ExerciseLog,
  ResolvedExercisePrescription,
} from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { ButtonComponent } from "../button/button.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
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
  selector: "app-current-exercise-page",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    StepperComponent,
    WeightAndRepsComponent,
  ],
  templateUrl: "./current-exercise-page.component.html",
  styleUrl: "./current-exercise-page.component.scss",
})
export class CurrentExercisePageComponent implements OnInit {
  state: InProgressState | null = null;
  exercise: ResolvedExercisePrescription | null = null;
  isLoading = true;

  workingSets: CompletedSet[] = [];
  activeSetIndex = 0;
  lastHistoryEntry: ExerciseHistoryEntry | null = null;
  showProgressionSuggestion = false;
  completedSetIndices = new Set<number>();
  private setStarted: boolean[] = [];
  protected setTouched: boolean[] = [];
  readonly repStep = 1;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
    public restTimer: RestTimerService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.loadExercise(params.get("workoutId"), params.get("exerciseId"));
    });
  }

  private loadExercise(
    workoutId: string | null,
    exerciseId: string | null,
  ): void {
    const state = this.workoutService.getInProgressState();
    if (!state || state.today.routine.id !== workoutId) {
      this.router.navigate(["/"]);
      return;
    }

    const exercise = state.today.routine.exercises.find(
      (item) => item.id === exerciseId,
    );
    if (!exercise) {
      this.router.navigate(["/current-workout", workoutId]);
      return;
    }

    const isCompleted = state.completedExerciseIds.includes(exercise.id);
    this.state = {
      ...state,
      activeExerciseId: isCompleted ? state.activeExerciseId : exercise.id,
    };
    this.workoutService.saveInProgressState(this.state);
    this.exercise = exercise;
    this.initSets();
    this.loadExerciseHistory();
    this.isLoading = false;
  }

  onSetsChanged(sets: CompletedSet[]): void {
    if (!this.state || !this.exercise) return;
    const workingSets = this.state.workingSets.filter(
      (entry) => entry.exerciseId !== this.exercise!.id,
    );
    workingSets.push({ exerciseId: this.exercise.id, sets });
    this.saveState({ ...this.state, workingSets });
  }

  onMarkComplete(): void {
    if (!this.state || !this.exercise) return;
    const completedExerciseIds = Array.from(
      new Set([...this.state.completedExerciseIds, this.exercise.id]),
    );
    const nextExercise = this.nextIncompleteExercise(completedExerciseIds);
    this.saveState({
      ...this.state,
      completedExerciseIds,
      activeExerciseId: null,
    });

    if (nextExercise) {
      this.router.navigate([
        "/current-workout",
        this.state.today.routine.id,
        nextExercise.id,
      ]);
      return;
    }

    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  goToWorkout(): void {
    if (!this.state) return;
    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  adjustRoutine(): void {
    if (!this.state || !this.exercise) return;

    this.router.navigate(
      [
        "/program/workout/edit",
        this.state.today.routine.id,
        "exercise",
        this.exercise.id,
      ],
      {
        state: {
          routine: this.state.today.routine,
          exercise: this.exercise,
          returnUrl: this.router.url,
        },
      },
    );
  }

  onProgressionSuggestionShown(): void {
    if (!this.state || !this.exercise) return;
    const progressionSuggestedExerciseIds = Array.from(
      new Set([
        ...(this.state.progressionSuggestedExerciseIds ?? []),
        this.exercise.id,
      ]),
    );
    this.saveState({ ...this.state, progressionSuggestedExerciseIds });
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
    return Array.from({ length: this.exercise?.targetSets ?? 0 }, () => ({
      targetAmount: this.exercise!.targetReps,
    }));
  }

  get currentWeightKg(): number {
    return this.workingSets[0]?.weightKg ?? this.exercise?.targetWeightKg ?? 0;
  }

  get activeSetDefaultReps(): number {
    if (this.setTouched[this.activeSetIndex]) {
      return this.workingSets[this.activeSetIndex].reps;
    }

    const previousCompletedSet = [...this.completedSetIndices]
      .sort((a, b) => b - a)
      .map((index) => this.workingSets[index])
      .find((set) => set !== undefined);

    return previousCompletedSet?.reps ?? this.exercise?.targetReps ?? 0;
  }

  get currentSetReps(): WeightAndRepsSet[] {
    return Array.from(
      { length: this.exercise?.targetSets ?? 0 },
      (_, index) => {
        const set = this.workingSets[index];
        const isComplete = this.completedSetIndices.has(index);

        return {
          targetAmount: this.exercise!.targetReps,
          achievedAmount: isComplete ? set!.reps : undefined,
        };
      },
    );
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
    if (!this.setTouched[idx]) {
      this.workingSets[idx] = {
        ...this.workingSets[idx],
        reps: this.activeSetDefaultReps,
      };
      this.setStarted[idx] = true;
    }

    this.completedSetIndices = new Set([...this.completedSetIndices, idx]);
    this.onSetsChanged(this.workingSets);

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
      this.onMarkComplete();
      return;
    }

    this.restTimer.start();
  }

  skipRestTimer(): void {
    this.restTimer.clear();
  }

  viewExerciseHistory(): void {
    this.router.navigate(["/history/exercises", this.exercise!.id]);
  }

  dismissProgressionSuggestion(): void {
    this.showProgressionSuggestion = false;
  }

  stepReps(setIndex: number, nextReps: number): void {
    const current = this.workingSets[setIndex];
    this.setStarted[setIndex] = nextReps > 0;
    this.setTouched[setIndex] = true;
    this.workingSets[setIndex] = { ...current, reps: Math.max(0, nextReps) };
    this.onSetsChanged(this.workingSets);
  }

  toWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
    return log.completedSets.map((set) => ({
      targetAmount: log.targetReps ?? set.reps,
      achievedAmount: log.targetReps === undefined ? undefined : set.reps,
    }));
  }

  formatWeight(weightKg: number): string {
    return this.units.formatWeight(weightKg);
  }

  goToNextExercise(): void {
    if (!this.state || !this.exercise) return;

    const exercises = this.state.today.routine.exercises;
    const currentIndex = exercises.findIndex(
      (item) => item.id === this.exercise!.id,
    );
    const nextExercise = exercises[currentIndex + 1];

    if (nextExercise) {
      this.router.navigate([
        "/current-workout",
        this.state.today.routine.id,
        nextExercise.id,
      ]);
      return;
    }

    this.router.navigate(["/current-workout", this.state.today.routine.id]);
  }

  get savedSets(): CompletedSet[] | null {
    if (!this.state || !this.exercise) return null;
    return (
      this.state.workingSets.find(
        (entry) => entry.exerciseId === this.exercise!.id,
      )?.sets ?? null
    );
  }

  get progressionSuggestionAlreadyShown(): boolean {
    return (
      this.state?.progressionSuggestedExerciseIds?.includes(
        this.exercise?.id ?? "",
      ) ?? false
    );
  }

  private initSets(): void {
    if (
      this.savedSets &&
      this.exercise &&
      this.savedSets.length === this.exercise.targetSets
    ) {
      this.workingSets = this.savedSets.map((set) => ({ ...set }));
      this.setStarted = this.savedSets.map((set) => set.reps > 0);
      this.setTouched = this.savedSets.map((set) => set.reps > 0);
      this.completedSetIndices = new Set(
        this.savedSets
          .map((set, index) => (set.reps > 0 ? index : -1))
          .filter((index) => index !== -1),
      );
      const firstIncomplete = this.workingSets.findIndex(
        (_, index) => !this.completedSetIndices.has(index),
      );
      this.activeSetIndex =
        firstIncomplete !== -1 ? firstIncomplete : this.workingSets.length - 1;
      return;
    }

    if (!this.exercise) return;
    this.workingSets = Array.from(
      { length: this.exercise.targetSets },
      (_, index) => ({
        setNumber: index + 1,
        reps: 0,
        weightKg: this.exercise!.targetWeightKg,
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

  private loadExerciseHistory(): void {
    if (!this.exercise) return;
    this.lastHistoryEntry = null;
    this.workoutService
      .getExerciseHistory(this.exercise.id)
      .subscribe((entries) => {
        this.lastHistoryEntry =
          entries.find((entry) => entry.log.completedSets.length > 0) ?? null;
        const shouldShowSuggestion =
          this.hasEarnedProgressionSuggestion(entries);
        this.showProgressionSuggestion = shouldShowSuggestion;
        if (shouldShowSuggestion) this.onProgressionSuggestionShown();
      });
  }

  private hasEarnedProgressionSuggestion(
    entries: ExerciseHistoryEntry[],
  ): boolean {
    if (!this.exercise) return false;
    const completedEntries = entries.filter(
      (entry) => entry.log.completedSets?.length > 0,
    );
    if (this.progressionSuggestionAlreadyShown || completedEntries.length < 3) {
      return false;
    }

    const recentLogs = completedEntries.slice(0, 3).map(({ log }) => log);
    const firstSets = recentLogs[0].completedSets;
    if (
      firstSets.length !== this.exercise.targetSets ||
      firstSets.some(
        (set) =>
          set.weightKg !== this.exercise!.targetWeightKg ||
          set.reps < this.exercise!.targetReps,
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

  private saveState(state: InProgressState): void {
    this.state = state;
    this.workoutService.saveInProgressState(state);
  }

  private nextIncompleteExercise(
    completedExerciseIds: string[],
  ): ResolvedExercisePrescription | undefined {
    if (!this.state || !this.exercise) return undefined;

    const exercises = this.state.today.routine.exercises
      .slice()
      .sort((left, right) => left.order - right.order);
    const currentIndex = exercises.findIndex(
      (item) => item.id === this.exercise!.id,
    );
    const isIncomplete = (item: ResolvedExercisePrescription) =>
      !completedExerciseIds.includes(item.id);

    return (
      exercises.slice(currentIndex + 1).find(isIncomplete) ??
      exercises.find(isIncomplete)
    );
  }
}
