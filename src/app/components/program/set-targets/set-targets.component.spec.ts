import { ComponentFixture, TestBed } from "@angular/core/testing";

import { UnitPreferenceService } from "../../../services/unit-preference.service";
import {
  SetTargets,
  SetTargetsComponent,
  resizeSetValues,
} from "./set-targets.component";

describe("SetTargetsComponent", () => {
  let component: SetTargetsComponent;
  let fixture: ComponentFixture<SetTargetsComponent>;
  let emitted: SetTargets[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetTargetsComponent],
    }).compileComponents();

    TestBed.inject(UnitPreferenceService).setUnitSystem("metric");
    fixture = TestBed.createComponent(SetTargetsComponent);
    component = fixture.componentInstance;
    component.targets = { weightsKg: [20, 20, 20], reps: [10, 10, 10] };
    emitted = [];
    component.targetsChange.subscribe((targets) => emitted.push(targets));
    fixture.detectChanges();
  });

  function stepperCount(): number {
    return fixture.nativeElement.querySelectorAll("app-stepper").length;
  }

  it("shows one weight, sets and reps by default", () => {
    expect(component.perSet).toBeFalse();
    // Weight, sets and reps.
    expect(stepperCount()).toBe(3);
  });

  it("changes every set's weight from the single weight stepper", () => {
    component.setAllWeights(25);

    expect(emitted).toEqual([
      { weightsKg: [25, 25, 25], reps: [10, 10, 10] },
    ]);
  });

  it("changes every set's reps from the single reps stepper", () => {
    component.setAllReps(8);

    expect(emitted).toEqual([
      { weightsKg: [20, 20, 20], reps: [8, 8, 8] },
    ]);
  });

  it("shows a weight and reps stepper per set when turned on", () => {
    component.setPerSet(true);
    fixture.detectChanges();

    // Sets, then weight and reps for each of the 3 sets.
    expect(stepperCount()).toBe(7);
  });

  it("changes only one set's weight or reps per set", () => {
    component.setPerSet(true);

    component.setWeight(1, 25);
    component.setReps(2, 8);

    expect(emitted).toEqual([
      { weightsKg: [20, 25, 20], reps: [10, 10, 10] },
      { weightsKg: [20, 20, 20], reps: [10, 10, 8] },
    ]);
  });

  it("adds sets copying the last set's weight and reps", () => {
    component.targets = { weightsKg: [20, 25], reps: [12, 10] };

    component.setSetCount(4);

    expect(emitted).toEqual([
      { weightsKg: [20, 25, 25, 25], reps: [12, 10, 10, 10] },
    ]);
  });

  it("goes back to the first set's weight and reps when turned off", () => {
    component.targets = { weightsKg: [20, 25, 30], reps: [12, 10, 8] };
    component.setPerSet(false);

    expect(component.perSet).toBeFalse();
    expect(emitted).toEqual([
      { weightsKg: [20, 20, 20], reps: [12, 12, 12] },
    ]);
  });

  it("starts per set when loaded weights differ", () => {
    component.targets = { weightsKg: [20, 25, 30], reps: [10, 10, 10] };

    expect(component.perSet).toBeTrue();
  });

  it("starts per set when loaded reps differ", () => {
    component.targets = { weightsKg: [20, 20, 20], reps: [12, 10, 8] };

    expect(component.perSet).toBeTrue();
  });

  it("hides the per-set option with a single set", () => {
    component.targets = { weightsKg: [20], reps: [10] };
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector("input[type=checkbox]"),
    ).toBeNull();
  });
});

describe("resizeSetValues", () => {
  it("copies the last set's value onto new sets", () => {
    expect(resizeSetValues([20, 25], 4, 0)).toEqual([20, 25, 25, 25]);
  });

  it("drops values from the end when sets are removed", () => {
    expect(resizeSetValues([20, 25, 30], 2, 0)).toEqual([20, 25]);
  });

  it("uses the fallback with no values", () => {
    expect(resizeSetValues([], 2, 1)).toEqual([1, 1]);
  });
});

describe("formatWeightRange", () => {
  let units: UnitPreferenceService;

  beforeEach(() => {
    units = TestBed.inject(UnitPreferenceService);
    units.setUnitSystem("metric");
  });

  it("shows one weight when they're all the same", () => {
    expect(units.formatWeightRange([20, 20])).toBe("20");
  });

  it("shows lightest to heaviest when they differ", () => {
    expect(units.formatWeightRange([25, 20, 30])).toBe("20–30");
  });
});
