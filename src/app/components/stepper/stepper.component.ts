import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
} from "@angular/core";

@Component({
  selector: "app-stepper",
  imports: [],
  templateUrl: "./stepper.component.html",
  styleUrl: "./stepper.component.scss",
})
export class StepperComponent implements OnDestroy {
  @Input({ required: true }) value!: number;
  @Input() minimum = 0;
  @Input() step = 1;
  @Input() unit = "";
  @Input() ariaLabel = "Value";

  @Output() valueChange = new EventEmitter<number>();

  editing = false;
  draftValue = "";

  private repeatTimer?: ReturnType<typeof setTimeout>;
  private holdAction?: () => void;
  private repeatCount = 0;
  private suppressClick = false;

  decrease(): void {
    if (this.value > this.minimum) {
      this.valueChange.emit(Math.max(this.minimum, this.value - this.step));
    }
  }

  increase(): void {
    this.valueChange.emit(this.value + this.step);
  }

  startEditing(): void {
    this.stopPress();
    this.editing = true;
    this.draftValue = String(this.value);
  }

  sanitizeDraft(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.draftValue = input.value.replace(/[^0-9.-]/g, "");
    input.value = this.draftValue;
  }

  handleEditKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      this.commitDraft();
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.cancelEditing();
    }
  }

  commitDraft(): void {
    const parsedValue = Number(this.draftValue);
    if (
      /^-?(?:\d+|\d*\.\d+)$/.test(this.draftValue) &&
      Number.isFinite(parsedValue)
    ) {
      if (parsedValue >= this.minimum) {
        this.valueChange.emit(parsedValue);
      }
    }

    this.cancelEditing();
  }

  cancelEditing(): void {
    this.editing = false;
    this.draftValue = "";
  }

  startPress(action: () => void, event: PointerEvent): void {
    event.preventDefault();
    this.stopPress();
    this.suppressClick = true;
    this.holdAction = action;
    this.repeatCount = 0;
    action();

    this.repeatTimer = setTimeout(() => this.repeat(), 350);
  }

  handleClick(action: () => void): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }

    action();
  }

  stopPress(): void {
    if (this.repeatTimer) {
      clearTimeout(this.repeatTimer);
      this.repeatTimer = undefined;
    }

    this.holdAction = undefined;
  }

  @HostListener("window:blur")
  onWindowBlur(): void {
    this.stopPress();
  }

  @HostListener("window:pointerup")
  @HostListener("window:pointercancel")
  onPointerEnd(): void {
    this.stopPress();
  }

  ngOnDestroy(): void {
    this.stopPress();
  }

  private repeat(): void {
    if (!this.holdAction) {
      return;
    }

    this.holdAction();
    this.repeatCount += 1;
    const nextDelay = Math.max(45, 130 - this.repeatCount * 8);
    this.repeatTimer = setTimeout(() => this.repeat(), nextDelay);
  }
}
