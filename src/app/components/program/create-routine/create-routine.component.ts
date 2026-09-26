import { Component, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
  ResolvedExercisePrescription,
  Routine,
} from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { ConfirmationModalComponent } from "../../confirmation-modal/confirmation-modal.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";
import { ReorderableCardListComponent } from "../../reorderable-card-list/reorderable-card-list.component";

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
  ],
  templateUrl: "./create-routine.component.html",
  styleUrl: "./create-routine.component.scss",
})
export class CreateRoutineComponent implements OnInit {
  draft!: Routine;
  saving = false;
  exerciseToDelete: ResolvedExercisePrescription | null = null;
  showDiscardConfirmation = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
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

  save(): void {
    const name = this.draft.name.trim();
    if (!name || this.saving) return;

    const routine: Routine = { ...this.draft, name };
    this.saving = true;
    this.workoutService.saveRoutine(routine).subscribe({
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
    this.router.navigate(["/program"]);
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
