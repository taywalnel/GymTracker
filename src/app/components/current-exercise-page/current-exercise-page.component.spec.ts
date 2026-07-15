import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CurrentExercisePageComponent } from './current-exercise-page.component';

describe('CurrentExercisePageComponent', () => {
  let component: CurrentExercisePageComponent;
  let fixture: ComponentFixture<CurrentExercisePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CurrentExercisePageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CurrentExercisePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
