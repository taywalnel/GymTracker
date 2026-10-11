import { Router } from "@angular/router";
import { of } from "rxjs";
import { Exercise, Routine } from "../../../models/workout.models";
import { NavigationHistoryService } from "../../../services/navigation-history.service";
import {
  RoutineGenerationService,
  RoutineSuggestion,
} from "../../../services/routine-generation.service";
import { WorkoutService } from "../../../services/workout.service";
import { CreateRoutineComponent } from "./create-routine.component";

describe("CreateRoutineComponent", () => {
  const prescription = (id: string, name: string) => ({
    id,
    name,
    targetWeightKg: 40,
    targetReps: 8,
    targetSets: 3,
    restSeconds: 90,
    order: 0,
  });

  const suggestion: RoutineSuggestion = {
    name: "Chest & Triceps",
    exercises: [
      prescription("bench", "Bench"),
      { ...prescription("fly", "Cable Fly"), order: 1 },
    ],
    newExercises: [{ id: "fly", name: "Cable Fly", primaryMuscleGroup: "chest" }],
  };

  let component: CreateRoutineComponent;
  let workoutService: jasmine.SpyObj<WorkoutService>;
  let generate: jasmine.Spy;
  let draftExercises: Exercise[];
  let calls: string[];

  beforeEach(() => {
    draftExercises = [];
    calls = [];
    workoutService = jasmine.createSpyObj<WorkoutService>("WorkoutService", [
      "getRoutineDraft",
      "saveRoutineDraft",
      "generateRoutineId",
      "getRoutineDraftExercises",
      "saveRoutineDraftExercises",
      "clearRoutineDraft",
      "saveExercise",
      "saveRoutine",
    ]);
    workoutService.getRoutineDraft.and.returnValue(null);
    workoutService.generateRoutineId.and.returnValue("routine-1");
    workoutService.getRoutineDraftExercises.and.callFake(() => draftExercises);
    workoutService.saveRoutineDraftExercises.and.callFake((exercises) => {
      draftExercises = exercises;
    });
    workoutService.saveExercise.and.callFake((exercise) => {
      calls.push(`exercise:${exercise.name}`);
      return of(exercise);
    });
    workoutService.saveRoutine.and.callFake((routine: Routine) => {
      calls.push(`routine:${routine.name}`);
      return of(routine);
    });
    generate = jasmine.createSpy("generate").and.resolveTo(suggestion);

    component = new CreateRoutineComponent(
      workoutService,
      { generate } as unknown as RoutineGenerationService,
      { navigate: jasmine.createSpy("navigate") } as unknown as Router,
      { back: jasmine.createSpy("back") } as unknown as NavigationHistoryService,
    );
    component.ngOnInit();
  });

  it("opens the picker straight away for an empty routine", () => {
    component.buildWithAi();

    expect(component.showReplaceConfirmation).toBeFalse();
    expect(component.showGenerator).toBeTrue();
  });

  it("asks before replacing exercises already added", () => {
    component.draft = {
      ...component.draft,
      exercises: [prescription("row", "Row")],
    };

    component.buildWithAi();

    expect(component.showReplaceConfirmation).toBeTrue();
    expect(component.showGenerator).toBeFalse();
  });

  it("fills the draft with the AI routine", async () => {
    component.openGenerator();

    await component.generateRoutine(["chest", "triceps"]);

    expect(generate).toHaveBeenCalledWith(["chest", "triceps"]);
    expect(component.draft.name).toBe("Chest & Triceps");
    expect(component.draft.exercises.map((e) => e.id)).toEqual([
      "bench",
      "fly",
    ]);
    expect(draftExercises).toEqual(suggestion.newExercises);
    expect(component.showGenerator).toBeFalse();
    expect(component.generating).toBeFalse();
  });

  it("keeps a name already typed", async () => {
    component.name = "Monday";

    await component.generateRoutine(["chest"]);

    expect(component.draft.name).toBe("Monday");
  });

  it("shows an error and keeps the picker open when it fails", async () => {
    generate.and.rejectWith({ code: "functions/internal" });
    component.openGenerator();

    await component.generateRoutine(["chest"]);

    expect(component.generateError).toContain("Couldn't build a routine");
    expect(component.showGenerator).toBeTrue();
    expect(component.draft.exercises).toEqual([]);
  });

  it("adds new exercises still in the routine to the catalog before saving it", async () => {
    await component.generateRoutine(["chest"]);
    component.draft = {
      ...component.draft,
      exercises: component.draft.exercises.map((e) =>
        e.id === "fly" ? { ...e, name: "Pec Fly" } : e,
      ),
    };

    component.save();

    expect(calls).toEqual(["exercise:Pec Fly", "routine:Chest & Triceps"]);
    expect(workoutService.saveExercise).toHaveBeenCalledWith({
      id: "fly",
      name: "Pec Fly",
      primaryMuscleGroup: "chest",
    });
  });

  it("skips new exercises removed from the routine", async () => {
    await component.generateRoutine(["chest"]);
    component.requestDeleteExercise("fly");
    component.confirmDeleteExercise();

    component.save();

    expect(workoutService.saveExercise).not.toHaveBeenCalled();
    expect(calls).toEqual(["routine:Chest & Triceps"]);
  });
});
