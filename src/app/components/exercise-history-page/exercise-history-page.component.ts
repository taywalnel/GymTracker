import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { forkJoin } from "rxjs";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  ExerciseCategory,
  ExerciseHistoryEntry,
  exerciseCategory,
  findExerciseByName,
} from "../../models/workout.models";
import { WorkoutService } from "../../services/workout.service";
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
  SetStripComponent,
  SetStripSet,
  logToSetStripSets,
} from "../set-strip/set-strip.component";
import { EmptyStateComponent } from "../empty-state/empty-state.component";
import { formatDaysAgo, formatLocalDate } from "../../utils/dates";
import {
  ExerciseHistoryItem,
  ExerciseHistorySummary,
  groupByMonth,
  markRecordSessions,
  summarizeHistory,
} from "../../utils/exercise-history";
import { NavigationHistoryService } from "../../services/navigation-history.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";

type HistoryRow = ExerciseHistoryItem & { sets: SetStripSet[] };

@Component({
  selector: "app-exercise-history-page",
  imports: [
    FormsModule,
    RouterLink,
    ChoiceListComponent,
    InputComponent,
    PageHeaderComponent,
    LoadingSpinnerComponent,
    SetStripComponent,
    ButtonComponent,
    ConfirmationModalComponent,
    EmptyStateComponent,
  ],
  templateUrl: "./exercise-history-page.component.html",
  styleUrl: "./exercise-history-page.component.scss",
})
export class ExerciseHistoryPageComponent implements OnInit {
  exerciseName = "Exercise";
  // Sessions that logged at least one set, newest first.
  historyMonths: { month: string; items: HistoryRow[] }[] = [];
  historySummary: ExerciseHistorySummary | null = null;
  sessionCount = 0;
  activeTab = "History";
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
      { label: "History", count: this.sessionCount },
      { label: "Manage" },
    ];
  }

  get latestSessionId(): string | null {
    return this.historyMonths[0]?.items[0]?.sessionId ?? null;
  }

  constructor(
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    private navigationHistory: NavigationHistoryService,
    public units: UnitPreferenceService,
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
      this.setHistory(entries);
      this.allExercises = exercises;
      this.exercise =
        exercises.find((exercise) => exercise.id === exerciseId) ?? null;
      this.exerciseName =
        this.exercise?.name ??
        entries[0]?.log.exerciseName ??
        this.humanizeExerciseId(exerciseId);
      this.resetEditForm();
      this.isLoading = false;
    });
  }

  private setHistory(entriesNewestFirst: ExerciseHistoryEntry[]): void {
    const completed = entriesNewestFirst.filter(
      (entry) => entry.log.completedSets.length > 0,
    );
    this.sessionCount = completed.length;
    this.historySummary = summarizeHistory(completed);
    this.historyMonths = groupByMonth(
      markRecordSessions(completed).map((item) => ({
        ...item,
        sets: logToSetStripSets(item.log),
      })),
    );
  }

  formatDate(date: string): string {
    return formatLocalDate(
      date,
      { weekday: "long", month: "long", day: "numeric", year: "numeric" },
      "en-GB",
    );
  }

  formatMonth(month: string): string {
    return formatLocalDate(
      `${month}-01`,
      { month: "long", year: "numeric" },
      "en-GB",
    );
  }

  dayOfMonth(date: string): string {
    return formatLocalDate(date, { day: "numeric" }, "en-GB");
  }

  weekday(date: string): string {
    return formatLocalDate(date, { weekday: "short" }, "en-GB");
  }

  readonly daysAgo = formatDaysAgo;

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
