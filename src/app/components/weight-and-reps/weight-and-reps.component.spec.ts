import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  WeightAndRepsComponent,
  logToWeightAndRepsSets,
  mainWeightKg,
} from './weight-and-reps.component';

describe('WeightAndRepsComponent', () => {
  let component: WeightAndRepsComponent;
  let fixture: ComponentFixture<WeightAndRepsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeightAndRepsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeightAndRepsComponent);
    component = fixture.componentInstance;
    component.sets = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows no per-set weights when every set is at the same weight', () => {
    component.sets = [
      { targetAmount: 10, weightKg: 20 },
      { targetAmount: 10, weightKg: 20 },
    ];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.weight-value')?.textContent).toBe('20');
    expect(element.querySelectorAll('.set-weight').length).toBe(0);
  });

  it('shows the weight under each set done at a different weight', () => {
    component.sets = [
      { targetAmount: 10, weightKg: 20 },
      { targetAmount: 10, weightKg: 25 },
      { targetAmount: 10, weightKg: 25 },
    ];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.weight-value')?.textContent).toBe('25');
    const labels = Array.from(element.querySelectorAll('.set-weight'));
    expect(labels.map((label) => label.textContent)).toEqual(['20']);
  });

  it('uses the given weight as the main weight', () => {
    component.weight = 15;
    component.sets = [
      { targetAmount: 10, weightKg: 20 },
      { targetAmount: 10 },
    ];
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.weight-value')?.textContent).toBe('15');
    const labels = Array.from(element.querySelectorAll('.set-weight'));
    expect(labels.map((label) => label.textContent)).toEqual(['20']);
  });
});

describe('WeightAndRepsComponent split by weight', () => {
  let component: WeightAndRepsComponent;
  let fixture: ComponentFixture<WeightAndRepsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WeightAndRepsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(WeightAndRepsComponent);
    component = fixture.componentInstance;
    component.splitByWeight = true;
  });

  function rowsShown(): string[][] {
    const element: HTMLElement = fixture.nativeElement;
    return Array.from(element.querySelectorAll('.weight-and-reps')).map(
      (row) => [
        row.querySelector('.weight-value')!.textContent!,
        ...Array.from(row.querySelectorAll('.set-container')).map(
          (set) => set.textContent!.trim(),
        ),
      ],
    );
  }

  it('groups consecutive sets at the same weight into one row', () => {
    component.sets = [
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 25 },
    ];
    fixture.detectChanges();

    expect(rowsShown()).toEqual([
      ['30', '6', '6'],
      ['25', '6'],
    ]);
  });

  it('starts a new row each time the weight changes, even back to an earlier weight', () => {
    component.sets = [
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 25 },
      { targetAmount: 6, weightKg: 30 },
    ];
    fixture.detectChanges();

    expect(rowsShown()).toEqual([
      ['30', '6'],
      ['25', '6'],
      ['30', '6'],
    ]);
  });

  it('keeps one row when every set is at the same weight', () => {
    component.sets = [
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 30 },
    ];
    fixture.detectChanges();

    expect(rowsShown()).toEqual([['30', '6', '6']]);
  });

  it("selects sets by their overall index and shows the dot in the active set's row", () => {
    component.sets = [
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 30 },
      { targetAmount: 6, weightKg: 25 },
    ];
    component.activeIndex = 2;
    fixture.detectChanges();
    const selected: number[] = [];
    component.setSelected.subscribe((index) => selected.push(index));

    const element: HTMLElement = fixture.nativeElement;
    const rows = element.querySelectorAll('.weight-and-reps');
    rows[1].querySelector<HTMLButtonElement>('.set-container')!.click();

    expect(selected).toEqual([2]);
    expect(rows[0].querySelector('.active-indicator')).toBeNull();
    expect(rows[1].querySelector('.active-indicator')).not.toBeNull();
  });
});

describe('mainWeightKg', () => {
  it('is the weight most sets were done at', () => {
    expect(mainWeightKg([20, 25, 25])).toBe(25);
  });

  it('is the earliest weight on a tie', () => {
    expect(mainWeightKg([20, 22.5, 25])).toBe(20);
  });

  it('is null with no sets', () => {
    expect(mainWeightKg([])).toBeNull();
  });
});

describe('logToWeightAndRepsSets', () => {
  it("keeps each set's weight", () => {
    expect(
      logToWeightAndRepsSets({
        exerciseId: 'bench',
        exerciseName: 'Bench',
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
