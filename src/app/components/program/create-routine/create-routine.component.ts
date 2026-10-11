import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { defaultIfEmpty, forkJoin, switchMap } from "rxjs";
import {
  MuscleGroup,
  ResolvedExercisePrescription,
  Routine,
} from "../../../models/workout.models";
import {
  RoutineGenerationService,
  RoutineSuggestion,
  routineGenerationErrorMessage,
} from "../../../services/routine-generation.service";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { ReorderableCardListComponent } from "../../reorderable-card-list/reorderable-card-list.component";
import { RoutineGeneratorModalComponent } from "../routine-generator-modal/routine-generator-modal.component";
import { NavigationHistoryService } from "../../../services/navigation-history.service";

// Builds a new routine as a draft (see WorkoutService.getRoutineDraft) so the
// add/edit exercise screens can change it before anything is written to
// Firestore. Creating it saves the draft and opens the routine's detail page.
@Component({
  selector: "app-create-routine",
  imports: [
    FormsModule,
    ButtonComponent,
    ConfirmationModalComponent,
    InputComponent,
    PageHeaderComponent,
    ReorderableCardListComponent,
    RoutineGeneratorModalComponent,
  ],
  templateUrl: "./create-routine.component.html",
  styleUrl: "./create-routine.component.scss",
})
export class CreateRoutineComponent implements OnInit {
  draft!: Routine;
  saving = false;
  exerciseToDelete: ResolvedExercisePrescription | null = null;
  showDiscardConfirmation = false;
  showReplaceConfirmation = false;
  showGenerator = false;
  generating = false;
  generateError: string | null = null;

  constructor(
    private workoutService: WorkoutService,
    private routineGeneration: RoutineGenerationService,
    private router: Router,
    private navigationHistory: NavigationHistoryService,
  ) {}

  ngOnInit(): void {
    // rotationOrder is reassigned on save; new routines go to the end.
    this.draft = this.workoutService.getRoutineDraft() ?? {
      id: this.workoutService.generateRoutineId(),
      name: "",
      rotationOrder: 0,
      exercises: [],
    };
    this.workoutService.saveRoutineDraft(this.draft);
  }

  get name(): string {
    return this.draft.name;
  }

  set name(name: string) {
    this.updateDraft({ ...this.draft, name });
  }

  get canSave(): boolean {
    return !!this.draft.name.trim();
  }

  get hasChanges(): boolean {
    return !!this.draft.name.trim() || this.draft.exercises.length > 0;
  }

  addExercise(): void {
    this.router.navigate(
      ["/program/workout/edit", this.draft.id, "add-exercise"],
      { state: { returnUrl: "/program/workout/new" } },
    );
  }

  editExercise(exerciseId: string): void {
    this.router.navigate(
      ["/program/workout/edit", this.draft.id, "exercise", exerciseId],
      { state: { returnUrl: "/program/workout/new" } },
    );
  }

  reorderExercises(exercises: ResolvedExercisePrescription[]): void {
    this.updateExercises(exercises);
  }

  requestDeleteExercise(exerciseId: string): void {
    this.exerciseToDelete =
      this.draft.exercises.find((exercise) => exercise.id === exerciseId) ??
      null;
  }

  cancelDeleteExercise(): void {
    this.exerciseToDelete = null;
  }

  confirmDeleteExercise(): void {
    if (!this.exerciseToDelete) return;

    const exerciseId = this.exerciseToDelete.id;
    this.exerciseToDelete = null;
    this.updateExercises(
      this.draft.exercises.filter((exercise) => exercise.id !== exerciseId),
    );
  }

  // Asks before an AI routine replaces exercises already added.
  buildWithAi(): void {
    if (this.draft.exercises.length > 0) {
      this.showReplaceConfirmation = true;
      return;
    }
    this.openGenerator();
  }

  openGenerator(): void {
    this.showReplaceConfirmation = false;
    this.generateError = null;
    this.showGenerator = true;
  }

  closeGenerator(): void {
    this.showGenerator = false;
  }

  async generateRoutine(muscleGroups: MuscleGroup[]): Promise<void> {
    if (this.generating) return;
    this.generating = true;
    this.generateError = null;
    try {
      const suggestion = await this.routineGeneration.generate(muscleGroups);
      this.applySuggestion(suggestion);
      this.showGenerator = false;
    } catch (error) {
      this.generateError = routineGenerationErrorMessage(error);
    } finally {
      this.generating = false;
    }
  }

  save(): void {
    const name = this.draft.name.trim();
    if (!name || this.saving) return;

    const routine: Routine = { ...this.draft, name };
    // Exercises from an AI routine join the catalog only now, with their
    // muscle group, and only if the routine still uses them.
    const newExercises = this.workoutService
      .getRoutineDraftExercises()
      .flatMap((exercise) => {
        const used = routine.exercises.find(({ id }) => id === exercise.id);
        return used ? [{ ...exercise, name: used.name }] : [];
      });
    this.saving = true;
    forkJoin(
      newExercises.map((exercise) => this.workoutService.saveExercise(exercise)),
    )
      .pipe(
        defaultIfEmpty([]),
        switchMap(() => this.workoutService.saveRoutine(routine)),
      )
      .subscribe({
      next: () => {
        this.workoutService.clearRoutineDraft();
        this.router.navigate(["/program/workout", routine.id], {
          replaceUrl: true,
        });
      },
      error: () => {
        this.saving = false;
        alert("Error saving routine");
      },
    });
  }

  cancel(): void {
    if (this.hasChanges) {
      this.showDiscardConfirmation = true;
      return;
    }
    this.discard();
  }

  discard(): void {
    this.workoutService.clearRoutineDraft();
    this.navigationHistory.back("/program");
  }

  // Keeps a name the person already typed.
  private applySuggestion(suggestion: RoutineSuggestion): void {
    this.updateDraft({
      ...this.draft,
      name: this.draft.name.trim() ? this.draft.name : suggestion.name,
      exercises: suggestion.exercises,
    });
    this.workoutService.saveRoutineDraftExercises(suggestion.newExercises);
  }

  private updateExercises(exercises: ResolvedExercisePrescription[]): void {
    this.updateDraft({
      ...this.draft,
      exercises: exercises.map((exercise, index) => ({
        ...exercise,
        order: index,
      })),
    });
  }

  private updateDraft(draft: Routine): void {
    this.draft = draft;
    this.workoutService.saveRoutineDraft(draft);
  }
}
