import { ActivatedRoute, Router } from "@angular/router";

import { ResolvedExercisePrescription } from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { CurrentExercisePageComponent } from "./current-exercise-page.component";

describe("CurrentExercisePageComponent", () => {
  const exercises: ResolvedExercisePrescription[] = [
    {
      id: "third",
      name: "Third",
      order: 3,
      targetWeightKg: 30,
      targetReps: 10,
      targetSets: 3,
    },
    {
      id: "first",
      name: "First",
      order: 1,
      targetWeightKg: 10,
      targetReps: 10,
      targetSets: 3,
    },
    {
      id: "second",
      name: "Second",
      order: 2,
      targetWeightKg: 20,
      targetReps: 10,
      targetSets: 3,
    },
  ];

  let component: CurrentExercisePageComponent;
  let navigate: jasmine.Spy;
  let saveInProgressState: jasmine.Spy;

  beforeEach(() => {
    navigate = jasmine.createSpy("navigate");
    saveInProgressState = jasmine.createSpy("saveInProgressState");
    component = new CurrentExercisePageComponent(
      {} as ActivatedRoute,
      { navigate } as unknown as Router,
      { saveInProgressState } as unknown as WorkoutService,
    );
  });

  it("navigates to the next incomplete exercise after the completed exercise", () => {
    setCurrentExercise("first", []);

    component.onMarkComplete();

    expect(navigate).toHaveBeenCalledWith([
      "/current-workout",
      "workout-1",
      "second",
    ]);
  });

  it("navigates to the first incomplete exercise when none after the current exercise remain", () => {
    setCurrentExercise("third", ["second"]);

    component.onMarkComplete();

    expect(navigate).toHaveBeenCalledWith([
      "/current-workout",
      "workout-1",
      "first",
    ]);
  });

  it("navigates to the workout overview when every exercise is complete", () => {
    setCurrentExercise("third", ["first", "second"]);

    component.onMarkComplete();

    expect(navigate).toHaveBeenCalledWith(["/current-workout", "workout-1"]);
  });

  function setCurrentExercise(
    exerciseId: string,
    completedExerciseIds: string[],
  ): void {
    component.exercise = exercises.find(
      (exercise) => exercise.id === exerciseId,
    )!;
    component.state = {
      today: {
        routine: {
          id: "workout-1",
          name: "Workout",
          rotationOrder: 0,
          exercises,
        },
        previousSession: null,
        lastPerformance: new Map(),
      },
      startedAt: 0,
      completedExerciseIds,
      activeExerciseId: exerciseId,
      workingSets: [],
    } as InProgressState;
  }
});
