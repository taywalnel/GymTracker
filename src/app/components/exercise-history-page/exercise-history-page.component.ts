import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  ExerciseCategory,
  ExerciseLog,
  exerciseCategory,
  findExerciseByName,
} from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
import {
  ExerciseHistoryEntry,
  ExerciseProgressionComponent,
} from "../exercise-progression/exercise-progression.component";
import {
  PageHeaderComponent,
  PageHeaderTab,
} from "../page-header/page-header.component";
import { LoadingSpinnerComponent } from "../loading-spinner/loading-spinner.component";
import { ButtonComponent } from "../button/button.component";
import {
  ChoiceListComponent,
  ChoiceOption,
} from "../choice-list/choice-list.component";
import { InputComponent } from "../input/input.component";
import { ConfirmationModalComponent } from "../confirmation-modal/confirmation-modal.component";
import {
  WeightAndRepsComponent,
  WeightAndRepsSet,
  logToWeightAndRepsSets,
} from "../weight-and-reps/weight-and-reps.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";
import { formatLocalDate } from "../../utils/dates";
import { NavigationHistoryService } from "../../services/navigation-history.service";

@Component({
  selector: "app-exercise-history-page",
  imports: [
    FormsModule,
    ChoiceListComponent,
    InputComponent,
    ExerciseProgressionComponent,
    PageHeaderComponent,
    LoadingSpinnerComponent,
    WeightAndRepsComponent,
    ButtonComponent,
    ConfirmationModalComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./exercise-history-page.component.html",
  styleUrl: "./exercise-history-page.component.scss",
})
export class ExerciseHistoryPageComponent implements OnInit {
  exerciseName = "Exercise";
  historyEntries: ExerciseHistoryEntry[] = [];
  activeTab = "Progression";
  isLoading = true;
  exerciseId: string | null = null;
  isDeleting = false;
  showDeleteConfirmation = false;

  // Manage tab: the catalog entry, edited in place.
  exercise: Exercise | null = null;
  private allExercises: Exercise[] = [];
  editName = "";
  editCategory: ExerciseCategory = "other";
  isSaving = false;
  showSavedMessage = false;
  readonly categoryOptions: ChoiceOption<ExerciseCategory>[] =
    EXERCISE_CATEGORIES.map((value) => ({
      value,
      label: EXERCISE_CATEGORY_LABELS[value],
    }));

  get hasUnsavedChanges(): boolean {
    return (
      !!this.exercise &&
      (this.editName.trim() !== this.exercise.name ||
        this.editCategory !== exerciseCategory(this.exercise))
    );
  }

  get nameError(): string | null {
    if (!this.editName.trim()) return "Enter a name for the exercise.";
    const duplicate = findExerciseByName(
      this.allExercises,
      this.editName,
      this.exercise?.id,
    );
    return duplicate
      ? `You already have an exercise called ${duplicate.name}.`
      : null;
  }

  get canSave(): boolean {
    return !this.nameError && this.hasUnsavedChanges && !this.isSaving;
  }

  get historyTabs(): PageHeaderTab[] {
    return [
      { label: "Progression" },
      { label: "Manage" },
      { label: "History", count: this.completedEntries.length },
    ];
  }

  get completedEntries(): ExerciseHistoryEntry[] {
    return this.historyEntries.filter(
      (entry) => entry.log.completedSets.length > 0,
    );
  }

  get historyDisplayEntries(): ExerciseHistoryEntry[] {
    return this.completedEntries.slice().reverse();
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private workoutService: WorkoutService,
    private navigationHistory: NavigationHistoryService,
  ) {}

  ngOnInit(): void {
    const exerciseId = this.route.snapshot.paramMap.get("exerciseId");
    if (!exerciseId) {
      this.isLoading = false;
      return;
    }
    this.exerciseId = exerciseId;

    forkJoin({
      entries: this.workoutService.getExerciseHistory(exerciseId),
      exercises: this.workoutService.getAllExercises(),
    }).subscribe(({ entries, exercises }) => {
      this.historyEntries = entries
        .slice()
        .sort((left, right) => left.date.localeCompare(right.date));
      this.allExercises = exercises;
      this.exercise =
        exercises.find((exercise) => exercise.id === exerciseId) ?? null;
      this.exerciseName =
        this.exercise?.name ??
        this.historyEntries[0]?.log.exerciseName ??
        this.humanizeExerciseId(exerciseId);
      this.resetEditForm();
      this.isLoading = false;
    });
  }

  formatDate(date: string): string {
    return formatLocalDate(
      date,
      { month: "long", day: "numeric", year: "numeric" },
      "en-GB",
    );
  }

  toWeightAndRepsSets(log: ExerciseLog): WeightAndRepsSet[] {
    return logToWeightAndRepsSets(log);
  }

  private humanizeExerciseId(id: string): string {
    return id.replace("ex-", "").replace(/-/g, " ");
  }

  onEditChange(): void {
    this.showSavedMessage = false;
  }

  saveExercise(): void {
    const name = this.editName.trim();
    if (!this.exercise || !name || !this.canSave) return;

    const exercise: Exercise = {
      id: this.exercise.id,
      name,
      ...(this.editCategory !== "other"
        ? { primaryMuscleGroup: this.editCategory }
        : {}),
    };
    this.isSaving = true;
    this.workoutService.saveExercise(exercise).subscribe({
      next: () => {
        this.exercise = exercise;
        this.allExercises = this.allExercises.map((item) =>
          item.id === exercise.id ? exercise : item,
        );
        this.exerciseName = exercise.name;
        this.resetEditForm();
        this.isSaving = false;
        this.showSavedMessage = true;
      },
      error: () => {
        this.isSaving = false;
        alert("Error saving exercise");
      },
    });
  }

  private resetEditForm(): void {
    this.editName = this.exercise?.name ?? "";
    this.editCategory = this.exercise
      ? exerciseCategory(this.exercise)
      : "other";
  }

  deleteExercise(): void {
    this.showDeleteConfirmation = true;
  }

  cancelDelete(): void {
    this.showDeleteConfirmation = false;
  }

  confirmDelete(): void {
    if (!this.exerciseId || this.isDeleting) return;

    this.isDeleting = true;
    this.workoutService.deleteExercise(this.exerciseId).subscribe({
      next: () => this.navigationHistory.back("/program?tab=Exercises"),
      error: () => {
        this.isDeleting = false;
        this.showDeleteConfirmation = false;
      },
    });
  }

  goBack(): void {
    this.navigationHistory.back("/program?tab=Exercises");
  }
}
