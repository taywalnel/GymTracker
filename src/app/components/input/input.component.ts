import { Component, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

@Component({
  selector: "app-input",
  imports: [],
  templateUrl: "./input.component.html",
  styleUrl: "./input.component.scss",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  @Input() id = "";
  @Input() label = "";
  @Input() type = "text";
  @Input() placeholder = "";
  @Input() min: number | null = null;
  @Input() step: number | null = null;
  @Input() inputmode:
    | "none"
    | "text"
    | "decimal"
    | "numeric"
    | "tel"
    | "search"
    | "email"
    | "url" = "text";
  @Input() required = false;
  @Input() invalid = false;
  @Input() error: string | null = null;
  @Input() disabled = false;

  value: string | number | null = "";

  private onChange: (value: string | number | null) => void = () => {};
  onTouched: () => void = () => {};

  get errorId(): string {
    return `${this.id}Error`;
  }

  writeValue(value: string | number | null): void {
    this.value = value;
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value =
      this.type === "number"
        ? input.value === ""
          ? null
          : Number.isFinite(input.valueAsNumber)
            ? input.valueAsNumber
            : null
        : input.value;
    this.onChange(this.value);
  }

  handleKeydown(event: KeyboardEvent): void {
    if (this.type !== "number") return;

    if (
      event.ctrlKey ||
      event.metaKey ||
      [
        "Backspace",
        "Delete",
        "Tab",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ].includes(event.key)
    ) {
      return;
    }

    if (!/^[0-9.]$/.test(event.key)) event.preventDefault();
  }
}
