import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Exercise } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";

@Component({
  selector: "app-exercise-editor",
  imports: [FormsModule, ButtonComponent, InputComponent, PageHeaderComponent],
  templateUrl: "./exercise-editor.component.html",
  styleUrl: "./exercise-editor.component.scss",
})
export class ExerciseEditorComponent {
  name = "";
  saving = false;
  validationAttempted = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  save(): void {
    this.validationAttempted = true;
    const name = this.name.trim();
    if (!name || this.saving) return;

    const exercise: Exercise = {
      id: this.workoutService.generateExerciseId(),
      name,
    };
    this.saving = true;
    this.workoutService.saveExercise(exercise).subscribe({
      next: () => this.router.navigate(["/program/exercises"]),
      error: () => {
        this.saving = false;
        alert("Error saving exercise");
      },
    });
  }

  cancel(): void {
    this.router.navigate(["/program/exercises"]);
  }
}
