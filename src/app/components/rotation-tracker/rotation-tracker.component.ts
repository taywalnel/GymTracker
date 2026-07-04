import { Component, OnInit, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routine } from '../../models/workout.models';
import { WorkoutService } from '../../services/workout.service';

@Component({
  selector: 'app-rotation-tracker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rotation-tracker.component.html',
  styleUrl: './rotation-tracker.component.scss',
})
export class RotationTrackerComponent implements OnInit {
  /** The id of the routine that is "today" — gets the active highlight */
  activeRoutineId = input.required<string>();

  routines: Routine[] = [];

  constructor(private workoutService: WorkoutService) {}

  ngOnInit(): void {
    this.workoutService.getAllRoutines().subscribe((routines) => {
      this.routines = routines;
    });
  }
}
