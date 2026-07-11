import {
  Component,
  ElementRef,
  OnInit,
  QueryList,
  ViewChildren,
} from "@angular/core";

import { FormsModule } from "@angular/forms";
import { Router, ActivatedRoute, RouterLink } from "@angular/router";
import { WorkoutService } from "../../services/workout.service";
import { Routine, ExercisePrescription } from "../../models/workout.models";
import { NavDotItem } from "../nav-dots/nav-dots.component";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { ButtonComponent } from "../button/button.component";

@Component({
  selector: "app-program-editor",
  imports: [FormsModule, RouterLink, ButtonComponent],
  templateUrl: "./program-editor.component.html",
  styleUrl: "./program-editor.component.scss",
})
export class ProgramEditorComponent implements OnInit {
  @ViewChildren("exerciseCard") private exerciseCards!: QueryList<
    ElementRef<HTMLElement>
  >;

  routineId: string | null = null;
  routine: Routine = {
    id: "",
    name: "",
    rotationOrder: 0,
    exercises: [],
  };
  loading = false;
  saving = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private workoutService: WorkoutService,
    readonly unitPref: UnitPreferenceService,
  ) {}

  ngOnInit(): void {
    this.routineId = this.route.snapshot.paramMap.get("id");
    if (this.routineId) {
      this.loadRoutine();
    } else {
      // New routine - initialize with empty state
      this.routine.id = this.workoutService.generateRoutineId();
    }
  }

  loadRoutine(): void {
    if (!this.routineId) return;
    this.loading = true;
    this.workoutService.getRoutineById(this.routineId).subscribe({
      next: (routine) => {
        if (routine) {
          this.routine = JSON.parse(JSON.stringify(routine)); // Deep copy
        }
        this.loading = false;
      },
    });
  }

  addExercise(): void {
    const newExercise: ExercisePrescription = {
      id: this.workoutService.generateExerciseId(),
      name: "",
      targetWeightKg: 0,
      targetReps: 10,
      targetSets: 3,
      order: this.routine.exercises.length,
    };
    this.routine.exercises.push(newExercise);

    setTimeout(() => {
      this.exerciseCards.last?.nativeElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }

  removeExercise(index: number): void {
    this.routine.exercises.splice(index, 1);
    // Reorder
    this.routine.exercises.forEach((ex, i) => {
      ex.order = i;
    });
  }

  moveExerciseUp(index: number): void {
    if (index > 0) {
      [this.routine.exercises[index - 1], this.routine.exercises[index]] = [
        this.routine.exercises[index],
        this.routine.exercises[index - 1],
      ];
      this.routine.exercises.forEach((ex, i) => {
        ex.order = i;
      });
    }
  }

  moveExerciseDown(index: number): void {
    if (index < this.routine.exercises.length - 1) {
      [this.routine.exercises[index], this.routine.exercises[index + 1]] = [
        this.routine.exercises[index + 1],
        this.routine.exercises[index],
      ];
      this.routine.exercises.forEach((ex, i) => {
        ex.order = i;
      });
    }
  }

  save(): void {
    if (!this.routine.name.trim()) {
      alert("Please enter a routine name");
      return;
    }
    if (this.routine.exercises.length === 0) {
      alert("Please add at least one exercise");
      return;
    }

    this.saving = true;
    this.workoutService.saveRoutine(this.routine).subscribe({
      next: () => {
        this.saving = false;
        this.router.navigate(["/program"]);
      },
      error: () => {
        this.saving = false;
        alert("Error saving routine");
      },
    });
  }

  cancel(): void {
    this.router.navigate(["/program"]);
  }

  exerciseDots(ex: ExercisePrescription): NavDotItem[] {
    return Array.from({ length: ex.targetSets }, (_, i) => ({
      id: i + 1,
      isActive: false,
      isComplete: true,
      label: ex.targetReps,
      ariaLabel: `Set ${i + 1}: ${ex.targetReps} reps`,
    }));
  }
}
