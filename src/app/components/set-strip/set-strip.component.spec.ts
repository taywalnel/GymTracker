import { ComponentFixture, TestBed } from "@angular/core/testing";

import { SetStripComponent, logToSetStripSets } from "./set-strip.component";

describe("SetStripComponent", () => {
  let component: SetStripComponent;
  let fixture: ComponentFixture<SetStripComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetStripComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SetStripComponent);
    component = fixture.componentInstance;
    component.label = "Today";
    element = fixture.nativeElement;
  });

  function label(): string {
    return element
      .querySelector(".section-label")!
      .textContent!.replace(/\s+/g, " ")
      .trim();
  }

  function tileWeights(): string[] {
    return Array.from(element.querySelectorAll(".set-strip__tile-weight")).map(
      (weight) => weight.textContent!.trim(),
    );
  }

  it("shows a weight every set shares once, in the label", () => {
    component.sets = [
      { targetAmount: 8, weightKg: 15 },
      { targetAmount: 8, weightKg: 15 },
    ];
    fixture.detectChanges();

    expect(label()).toBe("Today · 15 kg");
    expect(tileWeights()).toEqual([]);
  });

  it("shows each set's weight, with its unit, on its tile when the weights differ", () => {
    component.sets = [
      { targetAmount: 8, weightKg: 15 },
      { targetAmount: 12, weightKg: 12.5 },
      { targetAmount: 15, weightKg: 10 },
    ];
    fixture.detectChanges();

    expect(label()).toBe("Today");
    expect(tileWeights()).toEqual(["15kg", "12.5kg", "10kg"]);
  });

  it("shows only the label when no weights are known", () => {
    component.sets = [{ targetAmount: 8 }];
    fixture.detectChanges();

    expect(label()).toBe("Today");
    expect(tileWeights()).toEqual([]);
  });

  it("shows the reps done once a set is complete, coloured by result", () => {
    component.sets = [
      { targetAmount: 8, achievedAmount: 8 },
      { targetAmount: 8, achievedAmount: 6 },
      { targetAmount: 8, achievedAmount: 2 },
      { targetAmount: 8 },
    ];
    fixture.detectChanges();

    const tiles = Array.from(element.querySelectorAll(".set-strip__tile"));
    expect(tiles.map((tile) => tile.textContent!.trim())).toEqual([
      "8",
      "6",
      "2",
      "8",
    ]);
    expect(tiles.map((tile) => tile.classList[1])).toEqual([
      "set-strip__tile--good",
      "set-strip__tile--close",
      "set-strip__tile--miss",
      "set-strip__tile--pending",
    ]);
  });

  it("selects a set when its tile is tapped and marks the active one", () => {
    component.sets = [
      { targetAmount: 8, weightKg: 15 },
      { targetAmount: 8, weightKg: 12.5 },
    ];
    component.activeIndex = 0;
    fixture.detectChanges();
    const selected: number[] = [];
    component.setSelected.subscribe((index) => selected.push(index));

    const tiles = element.querySelectorAll<HTMLButtonElement>(
      "button.set-strip__tile",
    );
    tiles[1].click();

    expect(selected).toEqual([1]);
    expect(tiles[0].getAttribute("aria-current")).toBe("step");
    expect(tiles[0].getAttribute("aria-label")).toBe("Set 1: 8 reps at 15 kg");
    expect(element.querySelectorAll(".set-strip__ring").length).toBe(1);
  });

  it("shows sets as display-only without an active set", () => {
    component.sets = [{ targetAmount: 8 }];
    fixture.detectChanges();

    expect(element.querySelector("button")).toBeNull();
    expect(element.querySelector(".set-strip__ring")).toBeNull();
  });

  it("shows only the shared weight without a label", () => {
    component.label = "";
    component.sets = [{ targetAmount: 8, weightKg: 15 }];
    fixture.detectChanges();

    expect(label()).toBe("15 kg");
  });

  it("leaves out the label row without a label or a shared weight", () => {
    component.label = "";
    component.sets = [
      { targetAmount: 8, weightKg: 15 },
      { targetAmount: 8, weightKg: 10 },
    ];
    fixture.detectChanges();

    expect(element.querySelector(".section-label")).toBeNull();
  });

  it("places the ring by the tile size", () => {
    component.sets = [{ targetAmount: 8 }, { targetAmount: 8 }];
    component.activeIndex = 1;
    component.size = "small";
    fixture.detectChanges();

    const ring = element.querySelector<HTMLElement>(".set-strip__ring")!;
    expect(ring.style.transform).toBe("translateX(44px)");
  });
});

describe("logToSetStripSets", () => {
  it("keeps each set's weight", () => {
    expect(
      logToSetStripSets({
        exerciseId: "bench",
        exerciseName: "Bench",
        targetReps: 10,
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 20 },
          { setNumber: 2, reps: 8, weightKg: 15 },
        ],
      }),
    ).toEqual([
      { targetAmount: 10, achievedAmount: 10, weightKg: 20 },
      { targetAmount: 10, achievedAmount: 8, weightKg: 15 },
    ]);
  });
});
