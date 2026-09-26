import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import {
  EXERCISE_CATEGORIES,
  EXERCISE_CATEGORY_LABELS,
  Exercise,
  ExerciseCategory,
  exerciseCategory,
  findExerciseByName,
  ResolvedExercisePrescription,
  Routine,
} from "../../../models/workout.models";
import { UnitPreferenceService } from "../../../services/unit-preference.service";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import {
  ChoiceListComponent,
  ChoiceOption,
} from "../../choice-list/choice-list.component";
import { InputComponent } from "../../input/input.component";
import { LoadingSpinnerComponent } from "../../loading-spinner/loading-spinner.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { StepperComponent } from "../../stepper/stepper.component";
import { UnitToggleComponent } from "../../unit-toggle/unit-toggle.component";

@Component({
  selector: "app-add-exercise",
  imports: [
    FormsModule,
    ButtonComponent,
    ChoiceListComponent,
    InputComponent,
    LoadingSpinnerComponent,
    PageHeaderComponent,
    StepperComponent,
    UnitToggleComponent,
  ],
  templateUrl: "./add-exercise.component.html",
  styleUrl: "./add-exercise.component.scss",
})
export class AddExerciseComponent implements OnInit {
  exercises: Exercise[] = [];
  isLoadingExercises = true;
  loadError = false;
  weightKg: number | null = null;
  sets = 1;
  reps = 1;
  restSeconds = 60;
  step = 1;
  saving = false;
  saveToRoutine = true;
  selectedMuscleGroup: ExerciseCategory | null = null;
  selectedExercise: Exercise | null = null;
  // Inline form on step 2 for adding an exercise that isn't in the catalog yet.
  showNewExerciseForm = false;
  newExerciseName = "";
  newExerciseError: string | null = null;
  isSavingNewExercise = false;

  get pageTitle(): string {
    return "Add Exercise";
  }

  get isLiveWorkout(): boolean {
    return Boolean(this.workoutId);
  }

  get stepTitle(): string {
    return ["Exercise type", "Exercise", "Workout targets", "Overview"][
      this.step - 1
    ];
  }

  // Every category is always offered so an empty catalog isn't a dead end;
  // the count shows which ones already have exercises to pick from.
  get muscleGroups(): ChoiceOption<ExerciseCategory>[] {
    return EXERCISE_CATEGORIES.map((value) => {
      const label = EXERCISE_CATEGORY_LABELS[value];
      const count = this.addableExercises.filter(
        (exercise) => exerciseCategory(exercise) === value,
      ).length;
      return { value, label: count ? `${label} · ${count}` : label };
    });
  }

  get filteredExercises(): Exercise[] {
    return this.addableExercises.filter(
      (exercise) => exerciseCategory(exercise) === this.selectedMuscleGroup,
    );
  }

  get emptyGroupMessage(): string {
    const group = this.selectedMuscleGroupLabel.toLowerCase();
    const hasUsedExercises = this.exercises.some(
      (exercise) => exerciseCategory(exercise) === this.selectedMuscleGroup,
    );
    return hasUsedExercises
      ? `All your ${group} exercises are already in this routine. Add a new one below.`
      : `No ${group} exercises yet. Add one below.`;
  }

  private get addableExercises(): Exercise[] {
    const existingIds = new Set(this.routine?.exercises.map(({ id }) => id));
    return this.exercises.filter((exercise) => !existingIds.has(exercise.id));
  }

  get invalidRestSeconds(): boolean {
    return !Number.isInteger(this.restSeconds) || this.restSeconds < 0;
  }

  get canContinue(): boolean {
    switch (this.step) {
      case 1:
        return this.selectedMuscleGroup !== null;
      case 2:
        return this.showNewExerciseForm
          ? !!this.newExerciseName.trim()
          : this.selectedExercise !== null;
      case 3:
        return (
          this.weightKg !== null &&
          this.sets >= 1 &&
          this.reps >= 1 &&
          !this.invalidRestSeconds
        );
      default:
        return false;
    }
  }

  get selectedMuscleGroupLabel(): string {
    return this.selectedMuscleGroup
      ? EXERCISE_CATEGORY_LABELS[this.selectedMuscleGroup]
      : "";
  }

  get formattedWeight(): string {
    return this.weightKg === null
      ? ""
      : `${this.units.formatWeight(this.weightKg)} ${this.units.unitLabel()}`;
  }

  get weightUnit(): string {
    return this.units.unitLabel();
  }

  get weightStep(): number {
    return this.units.weightStep;
  }

  private get returnDestination(): string {
    if (this.returnUrl) return this.returnUrl;
    if (this.workoutId) return `/current-workout/${this.workoutId}`;
    return this.isDraft
      ? "/program/workout/new"
      : `/program/workout/${this.routineId}`;
  }

  private routine: Routine | undefined;
  private readonly returnUrl: string;
  private readonly replaceExerciseId: string | undefined;
  private routineId = "";
  private workoutId = "";
  // True when adding to the unsaved routine on the New Routine screen.
  private isDraft = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    private units: UnitPreferenceService,
  ) {
    const state =
      this.router.getCurrentNavigation()?.extras.state ?? history.state;
    this.routine = state["routine"] as Routine | undefined;
    this.returnUrl = (state["returnUrl"] as string | undefined) ?? "";
    this.replaceExerciseId = state["replaceExerciseId"] as string | undefined;
  }

  private get isSwap(): boolean {
    return Boolean(this.replaceExerciseId);
  }

  ngOnInit(): void {
    const params = this.route.snapshot.paramMap;
    this.routineId = params.get("id") ?? "";
    this.workoutId = params.get("workoutId") ?? "";

    this.workoutService.getAllExercises().subscribe({
      next: (exercises) => {
        this.exercises = [...exercises].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
        this.isLoadingExercises = false;
        this.loadRoutine();
      },
      error: () => {
        this.isLoadingExercises = false;
        this.loadError = true;
      },
    });
  }

  private loadRoutine(): void {
    if (this.workoutId) {
      const state = this.workoutService.getInProgressState();
      if (!state || state.today.routine.id !== this.workoutId) {
        this.router.navigateByUrl("/");
        return;
      }
      this.routine = state.today.routine;
      return;
    }

    if (!this.routineId) {
      this.router.navigateByUrl("/program");
      return;
    }

    const draft = this.workoutService.getRoutineDraft();
    if (draft?.id === this.routineId) {
      this.isDraft = true;
      this.initializeFromRoutine(draft);
      return;
    }

    const stateRoutine = this.routine;
    if (stateRoutine?.id === this.routineId) {
      this.initializeFromRoutine(stateRoutine);
      return;
    }

    this.workoutService.getRoutineById(this.routineId).subscribe({
      next: (routine) => {
        if (!routine) {
          this.router.navigateByUrl("/program");
          return;
        }
        this.initializeFromRoutine(routine);
      },
      error: () => this.router.navigateByUrl("/program"),
    });
  }

  private initializeFromRoutine(routine: Routine): void {
    this.routine = routine;
  }

  get weight(): number | null {
    if (this.weightKg === null) {
      return null;
    }

    return Number(this.units.fromKg(this.weightKg).toFixed(1));
  }

  set weight(value: number | null) {
    if (value !== null && Number.isFinite(value) && value >= 0) {
      this.weightKg = this.units.toKg(value);
    } else if (value === null) {
      this.weightKg = null;
    }
  }

  setWeight(value: number): void {
    this.weight = value;
  }

  chooseMuscleGroup(group: ExerciseCategory): void {
    this.selectedMuscleGroup = group;
    this.selectedExercise = null;
    this.closeNewExerciseForm();
    // Nothing to pick from, so go straight to adding one.
    this.showNewExerciseForm = this.filteredExercises.length === 0;
    this.step = 2;
  }

  chooseExercise(exercise: Exercise): void {
    this.selectedExercise = exercise;
    this.closeNewExerciseForm();
    this.step = 3;
  }

  openNewExerciseForm(): void {
    this.selectedExercise = null;
    this.showNewExerciseForm = true;
  }

  closeNewExerciseForm(): void {
    this.showNewExerciseForm = false;
    this.newExerciseName = "";
    this.newExerciseError = null;
  }

  // Adds the typed exercise to the catalog and selects it. A name that
  // matches an existing exercise selects that one instead of duplicating it.
  createExercise(): void {
    const name = this.newExerciseName.trim();
    const category = this.selectedMuscleGroup;
    if (!name || !category || this.isSavingNewExercise) return;

    const match = findExerciseByName(this.exercises, name);
    if (match) {
      if (this.routine?.exercises.some(({ id }) => id === match.id)) {
        this.newExerciseError = `${match.name} is already in this routine.`;
        return;
      }
      this.selectedMuscleGroup = exerciseCategory(match);
      this.chooseExercise(match);
      return;
    }

    const exercise: Exercise = {
      id: this.workoutService.generateExerciseId(),
      name,
      ...(category !== "other" ? { primaryMuscleGroup: category } : {}),
    };
    this.isSavingNewExercise = true;
    this.workoutService.saveExercise(exercise).subscribe({
      next: () => {
        this.isSavingNewExercise = false;
        this.exercises = [...this.exercises, exercise].sort((first, second) =>
          first.name.localeCompare(second.name),
        );
        this.chooseExercise(exercise);
      },
      error: () => {
        this.isSavingNewExercise = false;
        this.newExerciseError = "Couldn't save the exercise. Try again.";
      },
    });
  }

  next(): void {
    if (!this.canContinue) {
      return;
    }
    if (this.step === 2 && this.showNewExerciseForm) {
      this.createExercise();
      return;
    }
    this.step += 1;
  }

  previous(): void {
    if (this.step > 1) {
      this.step -= 1;
      return;
    }
    this.goBack();
  }

  goToStep(step: number): void {
    this.step = step;
  }

  save(): void {
    if (!this.selectedExercise || this.weightKg === null || !this.routine) {
      return;
    }

    const exercise: ResolvedExercisePrescription = {
      id: this.selectedExercise.id,
      name: this.selectedExercise.name,
      targetWeightKg: this.weightKg,
      targetSets: this.sets,
      targetReps: this.reps,
      restSeconds: this.restSeconds,
      order:
        this.routine.exercises.find(
          (item) => item.id === this.replaceExerciseId,
        )?.order ?? this.routine.exercises.length,
    };

    if (this.isLiveWorkout) {
      const updatedRoutine = {
        ...this.routine,
        exercises: this.isSwap
          ? this.routine.exercises.map((item) =>
              item.id === this.replaceExerciseId ? exercise : item,
            )
          : [...this.routine.exercises, exercise],
      };
      const inProgressState = this.workoutService.getInProgressState();
      if (!inProgressState) {
        this.router.navigateByUrl("/");
        return;
      }

      const saveState = () => {
        const workingSets = this.isSwap
          ? inProgressState.workingSets.filter(
              (entry) => entry.exerciseId !== this.replaceExerciseId,
            )
          : inProgressState.workingSets;
        const completedExerciseIds = this.isSwap
          ? inProgressState.completedExerciseIds.filter(
              (id) => id !== this.replaceExerciseId,
            )
          : inProgressState.completedExerciseIds;
        const progressionSuggestedExerciseIds = this.isSwap
          ? inProgressState.progressionSuggestedExerciseIds?.filter(
              (id) => id !== this.replaceExerciseId,
            )
          : inProgressState.progressionSuggestedExerciseIds;
        this.workoutService.saveInProgressState({
          ...inProgressState,
          today: { ...inProgressState.today, routine: updatedRoutine },
          activeExerciseId:
            this.isSwap &&
            inProgressState.activeExerciseId === this.replaceExerciseId
              ? exercise.id
              : inProgressState.activeExerciseId,
          workingSets,
          completedExerciseIds,
          progressionSuggestedExerciseIds,
        });
        const destination = this.isSwap
          ? this.returnUrl.replace(
              `/${this.replaceExerciseId}`,
              `/${exercise.id}`,
            )
          : `/current-workout/${this.workoutId}`;
        this.router.navigateByUrl(destination);
      };

      if (!this.saveToRoutine) {
        saveState();
        return;
      }

      this.saving = true;
      this.workoutService.saveRoutine(updatedRoutine).subscribe({
        next: saveState,
        error: () => {
          this.saving = false;
          alert("Error saving routine");
        },
      });
      return;
    }

    const updatedRoutine: Routine = {
      ...this.routine,
      exercises: [...this.routine.exercises, exercise],
    };
    if (this.isDraft) {
      this.workoutService.saveRoutineDraft(updatedRoutine);
      this.router.navigateByUrl(this.returnDestination);
      return;
    }

    this.saving = true;
    this.workoutService.saveRoutine(updatedRoutine).subscribe({
      next: () => this.router.navigateByUrl(this.returnDestination),
      error: () => {
        this.saving = false;
        alert("Error saving routine");
      },
    });
  }

  goBack(): void {
    this.router.navigateByUrl(this.returnDestination);
  }
}
