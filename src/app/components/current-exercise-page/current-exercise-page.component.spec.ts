import { ActivatedRoute, Router } from "@angular/router";

import { ResolvedExercisePrescription } from "../../models/workout.models";
import {
  InProgressState,
  WorkoutService,
} from "../../services/workout.service";
import { RestTimerService } from "../../services/rest-timer.service";
import { UnitPreferenceService } from "../../services/unit-preference.service";
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
  let startRestTimer: jasmine.Spy;
  let clearRestTimer: jasmine.Spy;
  let toKg: jasmine.Spy;

  beforeEach(() => {
    navigate = jasmine.createSpy("navigate");
    saveInProgressState = jasmine.createSpy("saveInProgressState");
    startRestTimer = jasmine.createSpy("start");
    clearRestTimer = jasmine.createSpy("clear");
    toKg = jasmine.createSpy("toKg").and.callFake((value: number) => value);
    component = new CurrentExercisePageComponent(
      {} as ActivatedRoute,
      { navigate } as unknown as Router,
      { saveInProgressState } as unknown as WorkoutService,
      { toKg } as unknown as UnitPreferenceService,
      {
        start: startRestTimer,
        clear: clearRestTimer,
      } as unknown as RestTimerService,
    );
  });

  it("uses the displayed previous-set reps when completing an untouched set", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 8, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
      { setNumber: 3, reps: 0, weightKg: 10 },
    ];
    component.completedSetIndices = new Set([0]);
    component.activeSetIndex = 1;

    component.completeCurrentSet();

    expect(component.workingSets[1].reps).toBe(8);
  });

  it("starts the rest timer with the exercise duration", () => {
    setCurrentExercise("first", []);
    component.exercise = { ...component.exercise!, restSeconds: 45 };
    component.workingSets = [
      { setNumber: 1, reps: 10, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
    ];

    component.completeCurrentSet();

    expect(startRestTimer).toHaveBeenCalledWith(45);
  });

  it("uses 60 seconds for an exercise without a rest duration", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 10, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
    ];

    component.completeCurrentSet();

    expect(startRestTimer).toHaveBeenCalledWith(60);
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

  it("does not save reps stepped on a set that hasn't been completed", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 10, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
      { setNumber: 3, reps: 0, weightKg: 10 },
    ];
    component.completedSetIndices = new Set([0]);

    component.stepReps(1, 9);

    const saved = saveInProgressState.calls.mostRecent()
      .args[0] as InProgressState;
    expect(saved.workingSets[0].sets.map((set) => set.reps)).toEqual([
      10, 0, 0,
    ]);
    expect(component.workingSets[1].reps).toBe(9);
  });

  it("sets the weight for the active set and later sets not yet completed", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 10, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
      { setNumber: 3, reps: 0, weightKg: 10 },
      { setNumber: 4, reps: 9, weightKg: 10 },
    ];
    component.completedSetIndices = new Set([0, 3]);
    component.activeSetIndex = 1;

    component.stepWeight(1, 15);

    expect(component.workingSets.map((set) => set.weightKg)).toEqual([
      10, 15, 15, 10,
    ]);
    expect(component.currentWeightKg).toBe(15);
  });

  it("logs a different weight for each set of a drop set", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 0, weightKg: 20 },
      { setNumber: 2, reps: 0, weightKg: 20 },
      { setNumber: 3, reps: 0, weightKg: 20 },
    ];

    component.completeCurrentSet();
    component.stepWeight(1, 15);
    component.completeCurrentSet();
    component.stepWeight(2, 10);
    component.completeCurrentSet();

    const saved = saveInProgressState.calls.mostRecent()
      .args[0] as InProgressState;
    expect(
      saved.workingSets[0].sets.map((set) => [set.reps, set.weightKg]),
    ).toEqual([
      [10, 20],
      [10, 15],
      [10, 10],
    ]);
  });

  it("keeps later sets' planned weights when weights are planned per set", () => {
    setCurrentExercise("first", []);
    component.exercise = {
      ...component.exercise!,
      setWeightsKg: [10, 15, 20],
    };
    component.workingSets = [
      { setNumber: 1, reps: 0, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 15 },
      { setNumber: 3, reps: 0, weightKg: 20 },
    ];

    component.stepWeight(0, 12.5);

    expect(component.workingSets.map((set) => set.weightKg)).toEqual([
      12.5, 15, 20,
    ]);
  });

  it("starts each set at its planned reps when reps are planned per set", () => {
    setCurrentExercise("first", []);
    component.exercise = {
      ...component.exercise!,
      targetReps: 12,
      setReps: [12, 10, 8],
    };
    component.workingSets = [
      { setNumber: 1, reps: 0, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
      { setNumber: 3, reps: 0, weightKg: 10 },
    ];

    component.completeCurrentSet();
    expect(component.activeTargetReps).toBe(10);
    expect(component.activeSetDefaultReps).toBe(10);
    component.completeCurrentSet();
    component.completeCurrentSet();

    expect(component.workingSets.map((set) => set.reps)).toEqual([12, 10, 8]);
    expect(component.currentSetReps.map((set) => set.targetAmount)).toEqual([
      12, 10, 8,
    ]);
  });

  it("repeats the last set's reps when the routine has one rep target", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 0, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
    ];
    component.stepReps(0, 8);
    component.completeCurrentSet();

    expect(component.activeSetDefaultReps).toBe(8);
  });

  it("shows the planned weight for the active set", () => {
    setCurrentExercise("first", []);
    component.exercise = {
      ...component.exercise!,
      setWeightsKg: [10, 15, 20],
    };
    component.activeSetIndex = 2;

    expect(component.activeTargetWeightKg).toBe(20);
  });

  it("saves a weight stepped on a set that hasn't been completed", () => {
    setCurrentExercise("first", []);
    component.workingSets = [
      { setNumber: 1, reps: 10, weightKg: 10 },
      { setNumber: 2, reps: 0, weightKg: 10 },
    ];
    component.completedSetIndices = new Set([0]);
    component.activeSetIndex = 1;

    component.stepWeight(1, 12.5);

    const saved = saveInProgressState.calls.mostRecent()
      .args[0] as InProgressState;
    expect(saved.workingSets[0].sets.map((set) => set.weightKg)).toEqual([
      10, 12.5,
    ]);
  });

  it("stores a stepped weight in kilograms", () => {
    setCurrentExercise("first", []);
    component.workingSets = [{ setNumber: 1, reps: 0, weightKg: 10 }];
    toKg.and.callFake((pounds: number) => pounds / 2);

    component.stepWeight(0, 30);

    expect(toKg).toHaveBeenCalledWith(30);
    expect(component.workingSets[0].weightKg).toBe(15);
  });

  it("finishes early with the logged sets and moves to the next exercise", () => {
    setCurrentExercise("first", []);
    component.completedSetIndices = new Set([0]);

    expect(component.canFinishEarly).toBeTrue();
    component.finishEarly();

    const saved = saveInProgressState.calls.mostRecent()
      .args[0] as InProgressState;
    expect(saved.completedExerciseIds).toEqual(["first"]);
    expect(clearRestTimer).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([
      "/current-workout",
      "workout-1",
      "second",
    ]);
  });

  it("can't finish early before any set is logged", () => {
    setCurrentExercise("first", []);

    expect(component.canFinishEarly).toBeFalse();
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
