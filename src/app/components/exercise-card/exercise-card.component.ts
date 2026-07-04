import { Component, EventEmitter, Input, Output, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ExercisePrescription, ExerciseLog, CompletedSet } from '../../models/workout.models';
import { UnitPreferenceService } from '../../services/unit-preference.service';

@Component({
  selector: 'app-exercise-card',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './exercise-card.component.html',
  styleUrl: './exercise-card.component.scss',
})
export class ExerciseCardComponent implements OnInit, OnChanges {
  @Input({ required: true }) exercise!: ExercisePrescription;
  @Input() lastLog: ExerciseLog | null = null;
  @Input() isCurrent = false;
  @Input() isComplete = false;

  /** Emits the updated set data every time the person edits a rep/weight value */
  @Output() setsChanged = new EventEmitter<CompletedSet[]>();
  /** Emits when the person marks this exercise as done for the session */
  @Output() markComplete = new EventEmitter<void>();

  /** Working sets, always stored internally in kg regardless of display unit. */
  workingSets: CompletedSet[] = [];

  /** Whether each set's reps stepper has been "started" — controls 0-state vs target-prefill behavior */
  private setStarted: boolean[] = [];

  readonly repStep = 1;

  constructor(public units: UnitPreferenceService) {}

  ngOnInit(): void {
    this.initSets();
  }

  ngOnChanges(): void {
    if (this.workingSets.length === 0) {
      this.initSets();
    }
  }

  private initSets(): void {
    this.workingSets = Array.from({ length: this.exercise.targetSets }, (_, i) => ({
      setNumber: i + 1,
      reps: 0,
      weightKg: this.exercise.targetWeightKg,
    }));
    this.setStarted = Array.from({ length: this.exercise.targetSets }, () => false);
  }

  /**
   * Stepping reps up from zero jumps straight to the target rep count (so a
   * single tap gets you to "I did what was planned"), then increments/decrements
   * by 1 from there. Stepping down from the target back to zero resets "started".
   */
  stepReps(setIndex: number, direction: 1 | -1): void {
    const current = this.workingSets[setIndex];
    let nextReps: number;

    if (!this.setStarted[setIndex] && direction === 1) {
      nextReps = this.exercise.targetReps;
      this.setStarted[setIndex] = true;
    } else {
      nextReps = Math.max(0, current.reps + direction * this.repStep);
      if (nextReps === 0) {
        this.setStarted[setIndex] = false;
      }
    }

    this.workingSets[setIndex] = { ...current, reps: nextReps };
    this.setsChanged.emit(this.workingSets);
  }

  /**
   * Steps weight in whatever unit is currently displayed (2.5 kg or 5 lb per
   * tap), then converts back to kg for storage so the underlying data never
   * depends on which unit was active when it was entered.
   */
  stepWeight(setIndex: number, direction: 1 | -1): void {
    const current = this.workingSets[setIndex];
    const displayValue = this.units.fromKg(current.weightKg);
    const nextDisplayValue = Math.max(0, displayValue + direction * this.units.weightStep);
    const nextWeightKg = this.units.toKg(nextDisplayValue);
    this.workingSets[setIndex] = { ...current, weightKg: nextWeightKg };
    this.setsChanged.emit(this.workingSets);
  }

  get hasAnyLoggedReps(): boolean {
    return this.workingSets.some((s) => s.reps > 0);
  }

  /** Formats a stored kg weight for display in whatever unit is currently active. */
  formatWeight(weightKg: number): string {
    return this.units.formatWeight(weightKg);
  }

  /** Renders the last session's sets as a compact string, e.g. "10 / 8 / 6" */
  formatLastSets(log: ExerciseLog): string {
    return log.completedSets.map((s) => s.reps).join(' / ');
  }
}
