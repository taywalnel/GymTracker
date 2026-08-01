import { Component, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

export interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: "app-select",
  imports: [],
  templateUrl: "./select.component.html",
  styleUrl: "./select.component.scss",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  @Input() id = "";
  @Input() label = "";
  @Input() placeholder = "Select an option";
  @Input() options: SelectOption[] = [];
  @Input() required = false;
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

  handleChange(event: Event): void {
    this.value = (event.target as HTMLSelectElement).value;
    this.onChange(this.value);
  }
}
