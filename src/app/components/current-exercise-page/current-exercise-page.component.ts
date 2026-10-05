import { Component, ElementRef, OnInit, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import {
  CompletedSet,
  ExerciseLog,
  ResolvedExercisePrescription,
  targetRepsForSet,
  targetRepsPerSet,
  targetWeightKgForSet,
  targetWeightsKg,
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
  logToWeightAndRepsSets,
} from "../weight-and-reps/weight-and-reps.component";
import { StepperComponent } from "../stepper/stepper.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import { ExerciseFeedbackModalComponent } from "../exercise-feedback-modal/exercise-feedback-modal.component";
import {
  ExerciseFeedbackService,
  FeedbackOfflineError,
} from "../../services/exercise-feedback.service";
import {
  ExerciseFeedback,
  FEEDBACK_MIN_HISTORY,
  FeedbackPrescription,
  applyRecommendation,
} from "../../models/exercise-feedback.models";
import { NavigationHistoryService } from "../../services/navigation-history.service";

interface ExerciseHistoryEntry {
  date: string;
  log: ExerciseLog;
}

/** The function's own message for errors it explains, otherwise a general one. */
function feedbackErrorMessage(error: unknown): string {
  if (error instanceof FeedbackOfflineError) {
    return "You're offline. Feedback needs a connection, so try again once you're back online.";
  }
  const { code, message } = (error ?? {}) as {
    code?: string;
    message?: string;
  };
  const explained = [
    "functions/resource-exhausted",
    "functions/failed-precondition",
    "functions/unavailable",
  ];
  return code && explained.includes(code) && message
    ? message
    : "Feedback isn't available right now. Try again in a moment.";
}

@Component({
  selector: "app-current-exercise-page",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    ExerciseFeedbackModalComponent,
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
  /** Past sessions with this exercise that have logged sets, newest first. */
  private completedHistory: ExerciseHistoryEntry[] = [];
  showProgressionSuggestion = false;
  showFeedback = false;
  feedback: ExerciseFeedback | null = null;
  feedbackError: string | null = null;
  isLoadingFeedback = false;
  isApplyingFeedback = false;
  /** Whether a change can go into today's workout: no sets were logged when asked. */
  feedbackAppliesToday = false;
  showExerciseActions = false;
  completedSetIndices = new Set<number>();
  private setStarted: boolean[] = [];
  private restDrain?: Animation;
  protected setTouched: boolean[] = [];
  readonly repStep = 1;
  protected readonly toWeightAndRepsSets = logToWeightAndRepsSets;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
    public restTimer: RestTimerService,
    private feedbackService: ExerciseFeedbackService,
    private navigationHistory: NavigationHistoryService,
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
      this.router.navigate(["/"], { replaceUrl: true });
      return;
    }

    const exercise = state.today.routine.exercises.find(
      (item) => item.id === exerciseId,
    );
    if (!exercise) {
      this.router.navigate(["/current-workout", workoutId], {
        replaceUrl: true,
      });
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
    // Only completed sets count as logged. Reps stepped on a set that hasn't
    // been completed stay on this page, so they don't show as progress
    // elsewhere or lock the exercise as in progress.
    const loggedSets = sets.map((set, index) =>
      this.completedSetIndices.has(index) ? set : { ...set, reps: 0 },
    );
    workingSets.push({ exerciseId: this.exercise.id, sets: loggedSets });
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
      this.advanceTo(nextExercise.id);
      return;
    }

    this.navigationHistory.leave(
      `/current-workout/${this.state.today.routine.id}`,
    );
  }

  goToWorkout(): void {
    if (!this.state) return;
    this.navigationHistory.back(
      `/current-workout/${this.state.today.routine.id}`,
    );
  }

  // Moving on to another exercise replaces this one, so Back from any
  // exercise returns to the workout rather than stepping through each one.
  private advanceTo(exerciseId: string): void {
    this.router.navigate(
      ["/current-workout", this.state!.today.routine.id, exerciseId],
      { replaceUrl: true },
    );
  }

  adjustRoutine(): void {
    if (!this.state || !this.exercise) return;

    this.showExerciseActions = false;

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

  /** Some sets are logged but not all, so the exercise can be ended early. */
  get canFinishEarly(): boolean {
    return (
      this.completedSetCount > 0 &&
      this.completedSetCount < (this.exercise?.targetSets ?? 0)
    );
  }

  // Marks the exercise complete with only the sets logged so far.
  finishEarly(): void {
    this.showExerciseActions = false;
    this.restTimer.clear();
    this.onMarkComplete();
  }

  swapExercise(): void {
    if (!this.state || !this.exercise) return;

    this.showExerciseActions = false;
    this.router.navigate(
      ["/current-workout", this.state.today.routine.id, "add-exercise"],
      {
        state: {
          routine: this.state.today.routine,
          returnUrl: this.router.url,
          replaceExerciseId: this.exercise.id,
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

  // The tide is recreated for each rest, so its drain starts whenever it
  // appears, picking up however much of the rest has already passed (e.g.
  // after a reload).
  @ViewChild("restTide")
  set restTide(ref: ElementRef<HTMLElement> | undefined) {
    this.restDrain?.cancel();
    this.restDrain = undefined;
    if (!ref) return;

    const durationMs = this.restTimer.duration * 1000;
    this.restDrain = ref.nativeElement.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }],
      { duration: durationMs, easing: "linear", fill: "forwards" },
    );
    this.restDrain.currentTime = durationMs - this.restTimer.remainingMs;
  }

  /** Remaining rest as m:ss, e.g. 1:05. */
  get restTimeLabel(): string {
    const secondsLeft = this.restTimer.secondsLeft ?? 0;
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  get targetSetReps(): WeightAndRepsSet[] {
    return Array.from(
      { length: this.exercise?.targetSets ?? 0 },
      (_, index) => ({
        targetAmount: targetRepsForSet(this.exercise!, index),
      }),
    );
  }

  get currentWeightKg(): number {
    return (
      this.workingSets[this.activeSetIndex]?.weightKg ??
      this.exercise?.targetWeightKg ??
      0
    );
  }

  /** The planned weight for the set being done. */
  get activeTargetWeightKg(): number {
    return this.exercise
      ? targetWeightKgForSet(this.exercise, this.activeSetIndex)
      : 0;
  }

  /** The planned reps for the set being done. */
  get activeTargetReps(): number {
    return this.exercise
      ? targetRepsForSet(this.exercise, this.activeSetIndex)
      : 0;
  }

  get currentWeightDisplay(): number {
    return Number(this.formatWeight(this.currentWeightKg));
  }

  /**
   * The reps shown for the active set before it's changed: its planned reps
   * when reps are planned per set, otherwise a repeat of the last set done.
   */
  get activeSetDefaultReps(): number {
    if (this.setTouched[this.activeSetIndex]) {
      return this.workingSets[this.activeSetIndex].reps;
    }
    if (this.exercise?.setReps) return this.activeTargetReps;

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
          targetAmount: targetRepsForSet(this.exercise!, index),
          achievedAmount: isComplete ? set!.reps : undefined,
          weightKg: set?.weightKg,
        };
      },
    );
  }

  // Any completed set can be revisited; otherwise only up to the next set to do.
  navigateToSet(index: number): void {
    if (
      index > this.activeSetIndex &&
      !this.completedSetIndices.has(index) &&
      !Array.from({ length: index }, (_, setIndex) => setIndex).every(
        (setIndex) => this.completedSetIndices.has(setIndex),
      )
    ) {
      return;
    }

    this.activeSetIndex = index;
  }

  get isActiveSetComplete(): boolean {
    return this.completedSetIndices.has(this.activeSetIndex);
  }

  /** Names every set a reset clears: the selected one and those done after it. */
  get resetSetLabel(): string {
    const lastSetNumber = Math.max(...this.setIndicesToReset) + 1;
    const firstSetNumber = this.activeSetIndex + 1;
    return lastSetNumber > firstSetNumber
      ? `Reset sets ${firstSetNumber}–${lastSetNumber}`
      : "Reset set";
  }

  // Sets are done in order, so resetting one also resets any done after it.
  private get setIndicesToReset(): number[] {
    return [...this.completedSetIndices].filter(
      (index) => index >= this.activeSetIndex,
    );
  }

  completeCurrentSet(): void {
    const idx = this.activeSetIndex;
    if (!this.setTouched[idx]) {
      this.workingSets[idx] = {
        ...this.workingSets[idx],
        reps: this.activeSetDefaultReps,
      };
      this.setStarted[idx] = true;
    }

    this.completedSetIndices = new Set([...this.completedSetIndices, idx]);
    this.onSetsChanged(this.workingSets);

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

    this.restTimer.start(this.exercise?.restSeconds ?? 60);
  }

  /**
   * Returns the selected set, and any done after it, to not done. Weights
   * stay; reps go back to the suggestion. An exercise already marked complete
   * reopens, since it now has sets left to do.
   */
  resetCurrentSet(): void {
    if (!this.state || !this.exercise) return;
    const resetIndices = new Set(this.setIndicesToReset);
    this.completedSetIndices = new Set(
      [...this.completedSetIndices].filter((index) => !resetIndices.has(index)),
    );
    for (const idx of resetIndices) {
      this.setTouched[idx] = false;
      this.setStarted[idx] = false;
      this.workingSets[idx] = { ...this.workingSets[idx], reps: 0 };
    }

    if (this.state.completedExerciseIds.includes(this.exercise.id)) {
      this.state = {
        ...this.state,
        completedExerciseIds: this.state.completedExerciseIds.filter(
          (id) => id !== this.exercise!.id,
        ),
        activeExerciseId: this.exercise.id,
      };
    }
    this.onSetsChanged(this.workingSets);
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

  /** Feedback needs a few past sessions to go on. */
  get canRequestFeedback(): boolean {
    return this.completedHistory.length >= FEEDBACK_MIN_HISTORY;
  }

  /** The exercise's targets with every set spelled out, for the feedback modal. */
  get currentPrescription(): FeedbackPrescription | null {
    if (!this.exercise) return null;
    return {
      setWeightsKg: targetWeightsKg(this.exercise),
      setReps: targetRepsPerSet(this.exercise),
      restSeconds: this.exercise.restSeconds ?? 60,
    };
  }

  requestFeedback(): void {
    if (!this.exercise) return;
    this.showFeedback = true;
    this.feedback = null;
    this.feedbackError = null;
    this.feedbackAppliesToday = this.completedSetCount === 0;

    const todaySets = [...this.completedSetIndices]
      .sort((a, b) => a - b)
      .map((index) => ({
        ...this.workingSets[index],
        targetReps: targetRepsForSet(this.exercise!, index),
      }));
    this.isLoadingFeedback = true;
    this.feedbackService
      .getFeedback(
        this.exercise.id,
        this.exercise.name,
        this.exercise,
        this.completedHistory,
        todaySets,
      )
      .then(
        (feedback) => (this.feedback = feedback),
        (error) => (this.feedbackError = feedbackErrorMessage(error)),
      )
      .finally(() => (this.isLoadingFeedback = false));
  }

  closeFeedback(): void {
    this.showFeedback = false;
  }

  /**
   * Saves the recommended targets to the routine. Before any set is logged
   * they also replace today's targets; after, today's workout stays as it is
   * and the change starts next time.
   */
  applyFeedback(): void {
    const recommendation = this.feedback?.recommendation;
    if (!this.state || !this.exercise || !recommendation) return;

    const routineId = this.state.today.routine.id;
    const exerciseId = this.exercise.id;
    const appliesToday =
      this.feedbackAppliesToday && this.completedSetCount === 0;
    this.isApplyingFeedback = true;

    this.workoutService.getRoutineById(routineId).subscribe({
      next: (routine) => {
        const saved = routine?.exercises.find((item) => item.id === exerciseId);
        if (!routine || !saved) {
          // Added to this workout only, so there's no routine to update.
          if (appliesToday) {
            this.applyToToday(recommendation);
            this.closeFeedback();
          } else {
            this.feedbackError =
              "This exercise isn't in your saved routine, so there's nothing to update for next time.";
          }
          this.isApplyingFeedback = false;
          return;
        }

        this.workoutService
          .saveRoutine({
            ...routine,
            exercises: routine.exercises.map((item) =>
              item.id === exerciseId
                ? applyRecommendation(item, recommendation)
                : item,
            ),
          })
          .subscribe({
            next: () => {
              if (appliesToday) this.applyToToday(recommendation);
              this.isApplyingFeedback = false;
              this.closeFeedback();
            },
            error: () => {
              this.isApplyingFeedback = false;
              this.feedbackError = "Couldn't save the change. Try again.";
            },
          });
      },
      error: () => {
        this.isApplyingFeedback = false;
        this.feedbackError = "Couldn't load your routine. Try again.";
      },
    });
  }

  /** Swaps in the new targets for this exercise in today's workout. */
  private applyToToday(recommendation: FeedbackPrescription): void {
    if (!this.state || !this.exercise) return;
    const exercise = applyRecommendation(this.exercise, recommendation);
    this.saveState({
      ...this.state,
      today: {
        ...this.state.today,
        routine: {
          ...this.state.today.routine,
          exercises: this.state.today.routine.exercises.map((item) =>
            item.id === exercise.id ? exercise : item,
          ),
        },
      },
      workingSets: this.state.workingSets.filter(
        (entry) => entry.exerciseId !== exercise.id,
      ),
    });
    this.exercise = exercise;
    this.initSets();
  }

  stepReps(setIndex: number, nextReps: number): void {
    const current = this.workingSets[setIndex];
    this.setStarted[setIndex] = nextReps > 0;
    this.setTouched[setIndex] = true;
    this.workingSets[setIndex] = { ...current, reps: Math.max(0, nextReps) };
    this.onSetsChanged(this.workingSets);
  }

  /**
   * Sets the weight for this set. With one planned weight, the change carries
   * forward to later sets not yet completed; with a weight planned for each
   * set, the later sets keep theirs.
   */
  stepWeight(setIndex: number, displayWeight: number): void {
    const weightKg = this.units.toKg(Math.max(0, displayWeight));
    const carryForward = !this.exercise?.setWeightsKg;
    this.workingSets = this.workingSets.map((set, index) =>
      index === setIndex ||
      (carryForward && index > setIndex && !this.completedSetIndices.has(index))
        ? { ...set, weightKg }
        : set,
    );
    this.onSetsChanged(this.workingSets);
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
      this.advanceTo(nextExercise.id);
      return;
    }

    this.navigationHistory.leave(
      `/current-workout/${this.state.today.routine.id}`,
    );
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
        weightKg: targetWeightKgForSet(this.exercise!, index),
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
    this.completedHistory = [];
    this.workoutService
      .getExerciseHistory(this.exercise.id)
      .subscribe((entries) => {
        this.completedHistory = entries.filter(
          (entry) => entry.log.completedSets.length > 0,
        );
        this.lastHistoryEntry = this.completedHistory[0] ?? null;
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
        (set, index) =>
          set.weightKg !== targetWeightKgForSet(this.exercise!, index) ||
          set.reps < targetRepsForSet(this.exercise!, index),
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
