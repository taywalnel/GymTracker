import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";

import {
  ExerciseLog,
  WorkoutSession,
  formatTargetReps,
  setTargetReps,
  targetRepsFields,
  targetWeightFields,
} from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { formatLocalDate, todayLocalDate } from "../../utils/dates";
import {
  ExerciseRecords,
  PersonalRecord,
  findSessionRecords,
} from "../../utils/personal-records";
import {
  describeRepDelta,
  findComparableLog,
  formatRepDelta,
  totalReps,
} from "../../utils/rep-comparison";
import { ButtonComponent } from "../button/button.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import { DateInputComponent } from "../date-input/date-input.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { RoutineCardComponent } from "../routine-card/routine-card.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
  logToWeightAndRepsSets,
} from "../weight-and-reps/weight-and-reps.component";

interface ExerciseDisplay {
  log: ExerciseLog;
  sets: WeightAndRepsSet[];
  /** e.g. "Target 3 × 10"; null on older logs without a rep target. */
  target: string | null;
  /** Total reps vs the matching session before this one; null when there's no match. */
  repDelta: number | null;
  /** Set a personal record in this session. */
  isRecord: boolean;
}

const RECORD_LABELS: Record<PersonalRecord["kind"], string> = {
  heaviestWeight: "Heaviest weight",
  estimatedOneRepMax: "Est. 1-rep max",
  repsAtWeight: "Most reps",
  sessionVolume: "Volume",
};

@Component({
  selector: "app-session-detail",
  imports: [
    ButtonComponent,
    ConfirmationModalComponent,
    DateInputComponent,
    FormsModule,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    RoutineCardComponent,
    WeightAndRepsComponent,
  ],
  templateUrl: "./session-detail.component.html",
  styleUrl: "./session-detail.component.scss",
})
export class SessionDetailComponent implements OnInit {
  session: WorkoutSession | null = null;
  exercises: ExerciseDisplay[] = [];
  /** Exercises in the routine with no logged sets. */
  skipped: ExerciseLog[] = [];
  /** Personal records set in this session, per exercise. */
  records: ExerciseRecords[] = [];
  /** Arrived straight from finishing the workout: show it as a summary. */
  justCompleted = false;
  isLoading = true;

  showEditForm = false;
  editDate = "";
  maxDate = todayLocalDate();
  editAttempted = false;
  isSaving = false;
  showDeleteConfirmation = false;
  isDeleting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    public units: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    const sessionId = this.route.snapshot.paramMap.get("sessionId") ?? "";
    this.justCompleted = history.state?.justCompleted === true;
    this.workoutService.getSessionHistory().subscribe((sessions) => {
      this.setSession(
        sessions.find((session) => session.id === sessionId) ?? null,
        sessions,
      );
      this.isLoading = false;
    });
  }

  get durationLabel(): string | null {
    const seconds = this.session?.durationSeconds;
    if (seconds === undefined) return null;
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) return "< 1 min";
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  }

  get totalRepDelta(): number | null {
    const deltas = this.exercises
      .map((exercise) => exercise.repDelta)
      .filter((delta): delta is number => delta !== null);
    return deltas.length === 0
      ? null
      : deltas.reduce((total, delta) => total + delta, 0);
  }

  formatDate(dateStr: string): string {
    return formatLocalDate(dateStr, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  recordLabel(record: PersonalRecord): string {
    return record.kind === "repsAtWeight"
      ? `${RECORD_LABELS.repsAtWeight} at ${this.formatWeight(record.weightKg ?? 0)}`
      : RECORD_LABELS[record.kind];
  }

  /** The new best, e.g. "62.5 kg" or "11 reps". */
  recordValue(record: PersonalRecord): string {
    return this.formatRecordAmount(record, record.value);
  }

  recordPrevious(record: PersonalRecord): string {
    return this.formatRecordAmount(record, record.previous);
  }

  /** Leaves the summary; replacing it so Back doesn't return to it. */
  done(): void {
    this.router.navigateByUrl("/", { replaceUrl: true });
  }

  private formatRecordAmount(record: PersonalRecord, amount: number): string {
    return record.kind === "repsAtWeight"
      ? `${amount} ${amount === 1 ? "rep" : "reps"}`
      : this.formatWeight(amount);
  }

  private formatWeight(kg: number): string {
    return `${this.units.formatWeight(kg)} ${this.units.unitLabel()}`;
  }

  readonly repDeltaLabel = formatRepDelta;
  readonly repDeltaDescription = describeRepDelta;

  // ---- edit date / delete ---------------------------------------------

  openEdit(): void {
    if (!this.session) return;
    this.editDate = this.session.date.slice(0, 10);
    this.maxDate = todayLocalDate();
    this.editAttempted = false;
    this.showEditForm = true;
  }

  closeEdit(): void {
    if (this.isSaving) return;
    this.showEditForm = false;
  }

  get editDateError(): string | null {
    if (!this.editDate) return "Choose a date.";
    if (this.editDate > this.maxDate) return "The date can't be in the future.";
    return null;
  }

  saveEdit(): void {
    if (!this.session) return;
    this.editAttempted = true;
    if (this.editDateError) return;
    if (this.editDate === this.session.date) {
      this.showEditForm = false;
      return;
    }

    this.isSaving = true;
    this.workoutService
      .saveSession({ ...this.session, date: this.editDate })
      .subscribe({
        next: (saved) => {
          this.isSaving = false;
          this.showEditForm = false;
          // Moving the date changes which sessions count as "last time".
          this.setSession(saved, this.workoutService.sessionsSignal());
        },
        error: () => {
          this.isSaving = false;
        },
      });
  }

  requestDelete(): void {
    this.showEditForm = false;
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDelete(): void {
    if (!this.session || this.isDeleting) return;
    this.isDeleting = true;
    this.workoutService.deleteSession(this.session.id).subscribe({
      next: () => this.router.navigateByUrl("/history"),
      error: () => {
        this.isDeleting = false;
        this.showDeleteConfirmation = false;
      },
    });
  }

  // ---- display --------------------------------------------------------

  private setSession(
    session: WorkoutSession | null,
    sessionsNewestFirst: readonly WorkoutSession[],
  ): void {
    this.session = session;
    this.exercises = [];
    this.skipped = [];
    this.records = [];
    if (!session) return;

    this.records = findSessionRecords(session, sessionsNewestFirst);
    const recordIds = new Set(this.records.map((item) => item.exerciseId));

    // Only sessions before this one count as "last time".
    const index = sessionsNewestFirst.findIndex(
      (item) => item.id === session.id,
    );
    const earlier = index === -1 ? [] : sessionsNewestFirst.slice(index + 1);

    for (const log of session.exerciseLogs) {
      if (log.completedSets.length === 0) {
        this.skipped.push(log);
        continue;
      }
      this.exercises.push({
        ...this.toExerciseDisplay(log, earlier),
        isRecord: recordIds.has(log.exerciseId),
      });
    }
  }

  private toExerciseDisplay(
    log: ExerciseLog,
    earlierSessions: readonly WorkoutSession[],
  ): Omit<ExerciseDisplay, "isRecord"> {
    const targetSets = log.targetSets ?? log.completedSets.length;
    const setTargets = log.completedSets.map(
      (set) => setTargetReps(log, set) ?? 0,
    );
    const previousLog =
      log.targetReps === undefined
        ? null
        : findComparableLog(earlierSessions, {
            id: log.exerciseId,
            ...targetWeightFields(
              log.completedSets.map((set) => set.weightKg),
            ),
            ...targetRepsFields(setTargets),
            targetSets,
            order: 0,
          });

    return {
      log,
      sets: logToWeightAndRepsSets(log),
      target:
        log.targetReps === undefined
          ? null
          : this.describeTarget(log.targetReps, setTargets, targetSets) +
            (log.completedSets.length < targetSets ? " · finished early" : ""),
      repDelta: previousLog
        ? totalReps(log.completedSets) - totalReps(previousLog.completedSets)
        : null,
    };
  }

  /** "Target 3 × 10", or each set's reps when they differ, e.g. "Target 12/10/8". */
  private describeTarget(
    targetReps: number,
    setTargets: readonly number[],
    targetSets: number,
  ): string {
    const perSet = formatTargetReps(setTargets);
    return setTargets.length && perSet.includes("/")
      ? `Target ${perSet}`
      : `Target ${targetSets} × ${targetReps}`;
  }
}
