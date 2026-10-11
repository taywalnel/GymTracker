import { Component, OnDestroy, OnInit, inject } from "@angular/core";
import {
  CDK_DRAG_CONFIG,
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDropList,
  DragDropConfig,
  moveItemInArray,
} from "@angular/cdk/drag-drop";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import {
  CompletedSet,
  ExerciseLog,
  ResolvedExercisePrescription,
  WorkoutSession,
  exerciseLogFromWorkingSets,
  targetRepsForSet,
} from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { ButtonComponent } from "../button/button.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { SetStripSet } from "../set-strip/set-strip.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";
import {
  describeRepDelta,
  findComparableLog,
  formatRepDelta,
  totalReps,
} from "../../utils/rep-comparison";
import { REORDER_SVG } from "../../constants/svg.constants";
import { localDateFromTimestamp } from "../../utils/dates";

const dragConfig: DragDropConfig = {
  dragStartThreshold: 0,
};

interface CurrentExerciseDisplay {
  id: string;
  name: string;
  targetWeightKg: number;
  setReps: SetStripSet[];
  isCompleted: boolean;
  /** Not completed, with at least one set logged. */
  isInProgress: boolean;
  loggedSetCount: number;
  /** Total reps vs the last time with the same weight, reps and sets; null when there's no match. */
  repDelta: number | null;
}

@Component({
  selector: "app-current-workout",
  imports: [
    ButtonComponent,
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    ConfirmationModalComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RoutineCardComponent,
  ],
  templateUrl: "./current-workout.component.html",
  styleUrl: "./current-workout.component.scss",
  providers: [{ provide: CDK_DRAG_CONFIG, useValue: dragConfig }],
})
export class CurrentWorkoutComponent implements OnInit, OnDestroy {
  // Created once so the [innerHTML] binding is stable; re-rendering the SVG
  // mid-drag stops iOS delivering touchmove events to the CDK.
  readonly reorderIcon: SafeHtml =
    inject(DomSanitizer).bypassSecurityTrustHtml(REORDER_SVG);

  state: InProgressState | null = null;
  /** Completed exercises first, then incomplete ones, each in routine order. */
  exercises: CurrentExerciseDisplay[] = [];
  isEditing = false;
  exerciseToDelete: CurrentExerciseDisplay | null = null;
  /** Set when starting `target` is blocked because `inProgress` isn't finished. */
  blockedSwitch: {
    inProgress: CurrentExerciseDisplay;
    target: CurrentExerciseDisplay;
  } | null = null;
  isLoading = true;
  isSaving = false;
  showDiscardConfirmation = false;
  showCompleteConfirmation = false;
  elapsedTime = "00:00:00";
  private elapsedTimeInterval: ReturnType<typeof setInterval> | null = null;
  private previousSessions: WorkoutSession[] = [];

  get completedExerciseCount(): number {
    return this.state?.completedExerciseIds.length ?? 0;
  }

  get totalExerciseCount(): number {
    return this.state?.today.routine.exercises.length ?? 0;
  }

  get completionPercentage(): number {
    return this.totalExerciseCount === 0
      ? 0
      : (this.completedExerciseCount / this.totalExerciseCount) * 100;
  }

  /** Seconds left on a rest started from an exercise page, or null when not resting. */
  get restSecondsLeft(): number | null {
    return this.restTimer.secondsLeft;
  }

  /** Summed rep change across completed exercises that have a past match; null when none do. */
  get totalRepDelta(): number | null {
    const deltas = this.exercises
      .filter((exercise) => exercise.isCompleted && exercise.repDelta !== null)
      .map((exercise) => exercise.repDelta!);
    return deltas.length === 0
      ? null
      : deltas.reduce((total, delta) => total + delta, 0);
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    private restTimer: RestTimerService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    const workoutId = this.route.snapshot.paramMap.get("workoutId");
    const state = this.workoutService.getInProgressState();
    if (!state || state.today.routine.id !== workoutId) {
      this.router.navigate(["/"]);
      return;
    }

    this.state = state;
    this.updateElapsedTime();
    this.elapsedTimeInterval = setInterval(
      () => this.updateElapsedTime(),
      1000,
    );
    this.buildExercises();
    this.isLoading = false;
    this.loadRepDeltas();
  }

  ngOnDestroy(): void {
    if (this.elapsedTimeInterval !== null) {
      clearInterval(this.elapsedTimeInterval);
    }
  }

  finishWorkout(): void {
    if (!this.state) return;
    if (this.completedExerciseCount < this.totalExerciseCount) {
      this.showCompleteConfirmation = true;
      return;
    }

    this.saveWorkout();
  }

  confirmFinishWorkout(): void {
    this.showCompleteConfirmation = false;
    this.saveWorkout();
  }

  cancelFinishWorkout(): void {
    this.showCompleteConfirmation = false;
  }

  private saveWorkout(): void {
    if (!this.state) return;
    this.isSaving = true;
    this.restTimer.clear();
    const workingSets = new Map<string, CompletedSet[]>(
      this.state.workingSets.map(({ exerciseId, sets }) => [exerciseId, sets]),
    );
    const exerciseLogs: ExerciseLog[] = this.sortedPrescriptions().map(
      (exercise) =>
        exerciseLogFromWorkingSets(exercise, workingSets.get(exercise.id) ?? []),
    );
    const session: WorkoutSession = {
      id: this.workoutService.generateSessionId(),
      routineId: this.state.today.routine.id,
      routineName: this.state.today.routine.name,
      // Dated by when it started, so a workout finished after midnight or
      // resumed the next day lands on the day it was done.
      date: localDateFromTimestamp(this.state.startedAt),
      durationSeconds: Math.max(
        0,
        Math.round((Date.now() - this.state.startedAt) / 1000),
      ),
      completedAt: new Date().toISOString(),
      exerciseLogs,
      inProgress: false,
    };

    this.workoutService.saveSession(session).subscribe({
      next: (saved) => {
        this.workoutService.clearInProgressState();
        this.router.navigate(["/history/session", saved.id], {
          state: { justCompleted: true },
        });
      },
      error: () => {
        this.isSaving = false;
      },
    });
  }

  openDiscardConfirmation(): void {
    this.showDiscardConfirmation = true;
  }

  cancelDiscard(): void {
    this.showDiscardConfirmation = false;
  }

  discardWorkout(): void {
    this.restTimer.clear();
    this.workoutService.clearInProgressState();
    this.router.navigate(["/"]);
  }

  addExercise(): void {
    if (!this.state) return;
    this.router.navigate([
      "/current-workout",
      this.state.today.routine.id,
      "add-exercise",
    ]);
  }

  toggleEditing(): void {
    this.isEditing = !this.isEditing;
  }

  // Completed exercises stay pinned at the top, so nothing can be dropped
  // above them.
  readonly canDropAt = (index: number): boolean =>
    index >= this.exercises.filter((exercise) => exercise.isCompleted).length;

  // Reordering only changes this workout. The saved order matches the list,
  // so the next exercise follows what's shown.
  reorderExercises(event: CdkDragDrop<CurrentExerciseDisplay[]>): void {
    if (!this.state || event.previousIndex === event.currentIndex) return;
    const ids = this.exercises.map((exercise) => exercise.id);
    moveItemInArray(ids, event.previousIndex, event.currentIndex);
    const prescriptions = new Map(
      this.state.today.routine.exercises.map((exercise) => [
        exercise.id,
        exercise,
      ]),
    );
    this.updateState({
      ...this.state,
      today: {
        ...this.state.today,
        routine: {
          ...this.state.today.routine,
          exercises: ids.map((id, index) => ({
            ...prescriptions.get(id)!,
            order: index,
          })),
        },
      },
    });
  }

  requestDeleteExercise(exerciseId: string): void {
    this.exerciseToDelete =
      this.exercises.find((exercise) => exercise.id === exerciseId) ?? null;
  }

  cancelDeleteExercise(): void {
    this.exerciseToDelete = null;
  }

  get deleteExerciseMessage(): string {
    if (!this.exerciseToDelete) return "";
    const hasLoggedSets = this.setsFor(this.exerciseToDelete.id).some(
      (set) => set.reps > 0,
    );
    return (
      `Remove ${this.exerciseToDelete.name} from this workout?` +
      (hasLoggedSets ? " Its logged sets will be lost." : "") +
      " Your routine won't change."
    );
  }

  // Deleting only removes the exercise from this workout, not the routine.
  confirmDeleteExercise(): void {
    if (!this.state || !this.exerciseToDelete) return;
    const exerciseId = this.exerciseToDelete.id;
    this.exerciseToDelete = null;
    this.updateState({
      ...this.state,
      today: {
        ...this.state.today,
        routine: {
          ...this.state.today.routine,
          exercises: this.state.today.routine.exercises.filter(
            (exercise) => exercise.id !== exerciseId,
          ),
        },
      },
      activeExerciseId:
        this.state.activeExerciseId === exerciseId
          ? null
          : this.state.activeExerciseId,
      completedExerciseIds: this.state.completedExerciseIds.filter(
        (id) => id !== exerciseId,
      ),
      workingSets: this.state.workingSets.filter(
        (entry) => entry.exerciseId !== exerciseId,
      ),
      progressionSuggestedExerciseIds:
        this.state.progressionSuggestedExerciseIds?.filter(
          (id) => id !== exerciseId,
        ),
    });
  }

  private updateState(state: InProgressState): void {
    this.state = state;
    this.workoutService.saveInProgressState(state);
    this.buildExercises();
  }

  private sortedPrescriptions(): ResolvedExercisePrescription[] {
    return (this.state?.today.routine.exercises ?? [])
      .slice()
      .sort((left, right) => left.order - right.order);
  }

  private buildExercises(): void {
    const completedIds = this.state?.completedExerciseIds ?? [];
    const prescriptions = this.sortedPrescriptions();
    this.exercises = [
      ...prescriptions.filter((exercise) => completedIds.includes(exercise.id)),
      ...prescriptions.filter(
        (exercise) => !completedIds.includes(exercise.id),
      ),
    ].map((exercise) => {
      const sets = this.setsFor(exercise.id);
      const previousLog = findComparableLog(this.previousSessions, exercise);
      const isCompleted = completedIds.includes(exercise.id);
      const loggedSetCount = sets.filter((set) => set.reps > 0).length;
      return {
        id: exercise.id,
        name: exercise.name,
        targetWeightKg: exercise.targetWeightKg,
        isCompleted,
        isInProgress: !isCompleted && loggedSetCount > 0,
        loggedSetCount,
        setReps: Array.from({ length: exercise.targetSets }, (_, index) => {
          const set = sets[index];
          const isComplete = (set?.reps ?? 0) > 0;
          return {
            targetAmount: targetRepsForSet(exercise, index),
            achievedAmount: isComplete ? set!.reps : undefined,
          };
        }),
        repDelta: previousLog
          ? totalReps(sets) - totalReps(previousLog.completedSets)
          : null,
      };
    });
  }

  private loadRepDeltas(): void {
    this.workoutService.getSessionHistory().subscribe((sessions) => {
      this.previousSessions = sessions;
      this.buildExercises();
    });
  }

  readonly repDeltaLabel = formatRepDelta;
  readonly repDeltaDescription = describeRepDelta;

  private setsFor(exerciseId: string): CompletedSet[] {
    return (
      this.state?.workingSets.find((sets) => sets.exerciseId === exerciseId)
        ?.sets ?? []
    );
  }

  private updateElapsedTime(): void {
    const elapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - (this.state?.startedAt ?? Date.now())) / 1000),
    );
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    this.elapsedTime = [hours, minutes, seconds]
      .map((value) => value.toString().padStart(2, "0"))
      .join(":");
  }

  // Only one exercise can be in progress: starting a different incomplete
  // exercise is blocked until the in-progress one is finished.
  navigateToExercise(exerciseId: string) {
    const target = this.exercises.find(
      (exercise) => exercise.id === exerciseId,
    );
    const inProgress = this.exercises.find(
      (exercise) => exercise.isInProgress && exercise.id !== exerciseId,
    );
    if (target && inProgress && !target.isCompleted && !target.isInProgress) {
      this.blockedSwitch = { inProgress, target };
      return;
    }

    this.openExercise(exerciseId);
  }

  get blockedSwitchMessage(): string {
    if (!this.blockedSwitch) return "";
    const { inProgress, target } = this.blockedSwitch;
    return (
      `You've logged ${inProgress.loggedSetCount} of ${inProgress.setReps.length} sets of ${inProgress.name}. ` +
      `Finish it before starting ${target.name}, or finish it early with the sets you've logged.`
    );
  }

  goToInProgressExercise(): void {
    if (!this.blockedSwitch) return;
    const exerciseId = this.blockedSwitch.inProgress.id;
    this.blockedSwitch = null;
    this.openExercise(exerciseId);
  }

  // Marks the in-progress exercise complete with the sets logged so far, then
  // starts the exercise that was tapped.
  finishEarlyAndSwitch(): void {
    if (!this.state || !this.blockedSwitch) return;
    const { inProgress, target } = this.blockedSwitch;
    this.blockedSwitch = null;
    this.restTimer.clear();
    this.updateState({
      ...this.state,
      completedExerciseIds: Array.from(
        new Set([...this.state.completedExerciseIds, inProgress.id]),
      ),
      activeExerciseId:
        this.state.activeExerciseId === inProgress.id
          ? null
          : this.state.activeExerciseId,
    });
    this.openExercise(target.id);
  }

  cancelBlockedSwitch(): void {
    this.blockedSwitch = null;
  }

  private openExercise(exerciseId: string): void {
    if (this.state) {
      this.router.navigate([
        `/current-workout/${this.state.today.routine.id}/${exerciseId}`,
      ]);
    }
  }

  getSetDotClass(set: SetStripSet): string {
    if (set.achievedAmount === undefined) return "status-dot";
    if (set.achievedAmount >= set.targetAmount) return "status-dot success";
    if (set.achievedAmount + 2 >= set.targetAmount) return "status-dot warn";
    return "status-dot danger";
  }
}
