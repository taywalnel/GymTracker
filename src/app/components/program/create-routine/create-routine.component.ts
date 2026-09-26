import { Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Routine } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { ButtonComponent } from "../../button/button.component";
import { InputComponent } from "../../input/input.component";
import { PageHeaderComponent } from "../../page-header/page-header.component";

// Names a new, empty routine, then hands off to the routine detail page where
// exercises are added.
@Component({
  selector: "app-create-routine",
  imports: [FormsModule, ButtonComponent, InputComponent, PageHeaderComponent],
  templateUrl: "./create-routine.component.html",
  styleUrl: "./create-routine.component.scss",
})
export class CreateRoutineComponent {
  name = "";
  saving = false;

  constructor(
    private workoutService: WorkoutService,
    private router: Router,
  ) {}

  get canSave(): boolean {
    return !!this.name.trim();
  }

  save(): void {
    const name = this.name.trim();
    if (!name || this.saving) return;

    // rotationOrder is reassigned on save; new routines go to the end.
    const routine: Routine = {
      id: this.workoutService.generateRoutineId(),
      name,
      rotationOrder: 0,
      exercises: [],
    };
    this.saving = true;
    this.workoutService.saveRoutine(routine).subscribe({
      next: () =>
        this.router.navigate(["/program/workout", routine.id], {
          replaceUrl: true,
        }),
      error: () => {
        this.saving = false;
        alert("Error saving routine");
      },
    });
  }

  cancel(): void {
    this.router.navigate(["/program"]);
  }
}
