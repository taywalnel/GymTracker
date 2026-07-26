import { Component, EventEmitter, Input, Output } from "@angular/core";

@Component({
  selector: "app-stepper",
  imports: [],
  templateUrl: "./stepper.component.html",
  styleUrl: "./stepper.component.scss",
})
export class StepperComponent {
  @Input({ required: true }) value!: number;
  @Input() minimum = 0;
  @Input() unit = "";
  @Input() ariaLabel = "Value";

  @Output() valueChange = new EventEmitter<number>();

  decrease(): void {
    if (this.value > this.minimum) {
      this.valueChange.emit(this.value - 1);
    }
  }

  increase(): void {
    this.valueChange.emit(this.value + 1);
  }
}
