import { ActivatedRoute, Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { Routine, WorkoutSession } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { WorkoutDetailComponent } from "./workout-detail.component";

describe("WorkoutDetailComponent", () => {
  const routine: Routine = {
    id: "routine-1",
    name: "Upper body",
    rotationOrder: 0,
    exercises: [
      {
        id: "exercise-1",
        name: "Bench press",
        order: 1,
        targetSets: 3,
        targetReps: 8,
        targetWeightKg: 60,
      },
    ],
  };

  const sessions: WorkoutSession[] = [
    {
      id: "old-session",
      routineId: "routine-1",
      routineName: "Upper body",
      date: "2026-01-02",
      exerciseLogs: [],
      inProgress: false,
    },
    {
      id: "in-progress-session",
      routineId: "routine-1",
      routineName: "Upper body",
      date: "2026-03-01",
      exerciseLogs: [],
      inProgress: true,
    },
    {
      id: "new-session",
      routineId: "routine-1",
      routineName: "Upper body",
      date: "2026-02-03",
      exerciseLogs: [],
      inProgress: false,
    },
    {
      id: "other-routine-session",
      routineId: "routine-2",
      routineName: "Lower body",
      date: "2026-04-01",
      exerciseLogs: [],
      inProgress: false,
    },
  ];

  let component: WorkoutDetailComponent;
  let deleteRoutine: jasmine.Spy;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    deleteRoutine = jasmine
      .createSpy("deleteRoutine")
      .and.returnValue(of(true));
    navigate = jasmine.createSpy("navigate");
    component = new WorkoutDetailComponent(
      {
        snapshot: { paramMap: { get: () => "routine-1" } },
      } as unknown as ActivatedRoute,
      { navigate } as unknown as Router,
      {
        getRoutineById: () => of(routine),
        getSessionHistory: () => of(sessions),
        deleteRoutine,
      } as unknown as WorkoutService,
    );
  });

  it("shows only completed sessions for the routine in reverse date order", () => {
    component.ngOnInit();

    expect(component.sessions.map((session) => session.id)).toEqual([
      "new-session",
      "old-session",
    ]);
    expect(component.detailTabs[1].count).toBe(2);
    expect(component.lastCompletedSession?.id).toBe("new-session");
  });

  it("navigates to the routine editor from Manage", () => {
    component.ngOnInit();

    component.editRoutine();

    expect(navigate).toHaveBeenCalledWith([
      "/program/workout/edit",
      "routine-1",
    ]);
  });

  it("returns to the routine list after deletion", () => {
    component.ngOnInit();

    component.confirmDelete();

    expect(deleteRoutine).toHaveBeenCalledWith("routine-1");
    expect(navigate).toHaveBeenCalledWith(["/program"]);
  });

  it("restores deletion state when deletion fails", () => {
    deleteRoutine.and.returnValue(throwError(() => new Error("Failed")));
    component.ngOnInit();
    component.showDeleteConfirmation = true;

    component.confirmDelete();

    expect(component.isDeleting).toBeFalse();
    expect(component.showDeleteConfirmation).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();
  });
});
