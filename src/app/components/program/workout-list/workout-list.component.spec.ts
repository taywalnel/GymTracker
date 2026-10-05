import { CdkDragDrop } from "@angular/cdk/drag-drop";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";
import { of, throwError } from "rxjs";
import { Routine } from "../../../models/workout.models";
import { WorkoutService } from "../../../services/workout.service";
import { WorkoutListComponent } from "./workout-list.component";

describe("WorkoutListComponent", () => {
  const routine = (
    id: string,
    rotationOrder: number,
    active?: boolean,
  ): Routine => ({ id, name: id, rotationOrder, active, exercises: [] });

  const routines = [
    routine("push", 0),
    routine("pull", 1),
    routine("legs", 2),
    routine("arms", 3, false),
  ];

  let component: WorkoutListComponent;
  let saveRoutineOrder: jasmine.Spy;
  let navigate: jasmine.Spy;

  const ids = (list: Routine[]) => list.map((r) => r.id);
  const savedRoutines = (): Routine[] =>
    saveRoutineOrder.calls.mostRecent().args[0];
  const dropEvent = (previousIndex: number, currentIndex: number) =>
    ({ previousIndex, currentIndex }) as CdkDragDrop<unknown>;

  beforeEach(() => {
    saveRoutineOrder = jasmine
      .createSpy("saveRoutineOrder")
      .and.callFake((list: Routine[]) => of(list));
    navigate = jasmine.createSpy("navigate");
    component = TestBed.runInInjectionContext(
      () =>
        new WorkoutListComponent(
          {
            getAllRoutines: () => of(routines),
            saveRoutineOrder,
          } as unknown as WorkoutService,
          { navigate } as unknown as Router,
        ),
    );
    component.ngOnInit();
    component.editing = true;
  });

  it("splits routines into rotation and library", () => {
    expect(ids(component.rotationRoutines)).toEqual(["push", "pull", "legs"]);
    expect(ids(component.libraryRoutines)).toEqual(["arms"]);
  });

  it("moves a rotation routine to the end of the library", () => {
    component.toggleActive(component.rotationRoutines[1]);

    expect(ids(component.rotationRoutines)).toEqual(["push", "legs"]);
    expect(ids(component.libraryRoutines)).toEqual(["arms", "pull"]);
    expect(
      savedRoutines().map(({ id, active, rotationOrder }) => ({
        id,
        active,
        rotationOrder,
      })),
    ).toEqual([
      { id: "push", active: undefined, rotationOrder: 0 },
      { id: "legs", active: undefined, rotationOrder: 1 },
      { id: "arms", active: false, rotationOrder: 2 },
      { id: "pull", active: false, rotationOrder: 3 },
    ]);
  });

  it("adds a library routine to the end of the rotation", () => {
    component.toggleActive(component.libraryRoutines[0]);

    expect(ids(component.rotationRoutines)).toEqual([
      "push",
      "pull",
      "legs",
      "arms",
    ]);
    expect(component.libraryRoutines).toEqual([]);
    expect(savedRoutines()[3].active).toBeTrue();
  });

  it("reorders within the rotation", () => {
    component.drop("rotation", dropEvent(2, 0));

    expect(ids(component.rotationRoutines)).toEqual(["legs", "push", "pull"]);
    expect(ids(savedRoutines())).toEqual(["legs", "push", "pull", "arms"]);
  });

  it("skips saving a drop back in the same place", () => {
    component.drop("rotation", dropEvent(1, 1));

    expect(saveRoutineOrder).not.toHaveBeenCalled();
  });

  it("restores the list when saving fails", () => {
    saveRoutineOrder.and.returnValue(throwError(() => new Error("Failed")));

    component.toggleActive(component.rotationRoutines[0]);

    expect(ids(component.rotationRoutines)).toEqual(["push", "pull", "legs"]);
    expect(ids(component.libraryRoutines)).toEqual(["arms"]);
  });

  it("opens a routine only when not editing", () => {
    component.viewRoutine(routines[0]);
    expect(navigate).not.toHaveBeenCalled();

    component.editing = false;
    component.viewRoutine(routines[0]);
    expect(navigate).toHaveBeenCalledWith(["/program/workout", "push"]);
  });
});
