import { Component, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

@Component({
  selector: "app-date-input",
  imports: [],
  templateUrl: "./date-input.component.html",
  styleUrl: "./date-input.component.scss",
  // `id` is forwarded to the inner control; drop it from the host so the
  // label's `for` doesn't point at a duplicate, unlabelable element.
  host: { "[attr.id]": "null" },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true,
    },
  ],
})
export class DateInputComponent implements ControlValueAccessor {
  @Input() id = "";
  @Input() label = "";
  @Input() invalid = false;
  @Input() error: string | null = null;
  @Input() disabled = false;

  value = "";

  private onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  get errorId(): string {
    return `${this.id}Error`;
  }

  writeValue(value: string | null): void {
    this.value = value ?? "";
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleInput(event: Event): void {
    this.value = (event.target as HTMLInputElement).value;
    this.onChange(this.value);
  }
}
