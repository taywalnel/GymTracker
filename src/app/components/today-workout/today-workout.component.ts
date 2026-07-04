import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodayWorkout, WorkoutSession, ExerciseLog, CompletedSet } from '../../models/workout.models';
import { WorkoutService } from '../../services/workout.service';
import { RotationTrackerComponent } from '../rotation-tracker/rotation-tracker.component';
import { ExerciseCardComponent } from '../exercise-card/exercise-card.component';

@Component({
  selector: 'app-today-workout',
  standalone: true,
  imports: [CommonModule, RotationTrackerComponent, ExerciseCardComponent],
  templateUrl: './today-workout.component.html',
  styleUrl: './today-workout.component.scss',
})
export class TodayWorkoutComponent implements OnInit {
  today: TodayWorkout | null = null;
  isLoading = true;
  isSaving = false;
  saveConfirmed = false;

  /** Tracks which exercises have been marked done this session, by exercise id */
  completedExerciseIds = new Set<string>();
  /** Working copy of sets per exercise id, kept in sync as the person types */
  workingSetsByExerciseId = new Map<string, CompletedSet[]>();

  todayDateLabel = '';

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.todayDateLabel = new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    this.loadToday();
  }

  private loadToday(): void {
    this.isLoading = true;
    this.workoutService.getTodayWorkout().subscribe((today) => {
      this.today = today;
      this.isLoading = false;
    });
  }

  get currentExerciseId(): string | null {
    if (!this.today) return null;
    const next = this.today.routine.exercises
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((ex) => !this.completedExerciseIds.has(ex.id));
    return next?.id ?? null;
  }

  get allExercisesComplete(): boolean {
    if (!this.today) return false;
    return this.today.routine.exercises.every((ex) => this.completedExerciseIds.has(ex.id));
  }

  get completedCount(): number {
    return this.completedExerciseIds.size;
  }

  get totalCount(): number {
    return this.today?.routine.exercises.length ?? 0;
  }

  onSetsChanged(exerciseId: string, sets: CompletedSet[]): void {
    this.workingSetsByExerciseId.set(exerciseId, sets);
  }

  onMarkComplete(exerciseId: string): void {
    this.completedExerciseIds.add(exerciseId);
  }

  /** Persists the whole session (all exercises logged so far) as a finished workout. */
  finishSession(): void {
    if (!this.today) return;
    this.isSaving = true;

    const exerciseLogs: ExerciseLog[] = this.today.routine.exercises.map((ex) => {
      const sets = this.workingSetsByExerciseId.get(ex.id) ?? [];
      const loggedSets = sets.filter((s) => s.reps > 0);
      return {
        exerciseId: ex.id,
        exerciseName: ex.name,
        completedSets: loggedSets,
      };
    });

    const session: WorkoutSession = {
      id: this.workoutService.generateSessionId(),
      routineId: this.today.routine.id,
      routineName: this.today.routine.name,
      date: new Date().toISOString().slice(0, 10),
      exerciseLogs,
      inProgress: false,
    };

    this.workoutService.saveSession(session).subscribe(() => {
      this.isSaving = false;
      this.saveConfirmed = true;
    });
  }

  get hasAnyProgress(): boolean {
    return this.workingSetsByExerciseId.size > 0 &&
      Array.from(this.workingSetsByExerciseId.values()).some((sets) => sets.some((s) => s.reps > 0));
  }
}
