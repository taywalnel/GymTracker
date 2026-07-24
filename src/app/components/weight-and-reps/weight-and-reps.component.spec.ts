import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WeightAndRepsComponent } from './weight-and-reps.component';

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
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
