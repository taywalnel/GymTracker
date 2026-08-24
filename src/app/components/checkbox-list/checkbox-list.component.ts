import { Component, Input, forwardRef } from "@angular/core";
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";

import { SelectOption } from "../select/select.component";

@Component({
  selector: "app-checkbox-list",
  imports: [],
  templateUrl: "./checkbox-list.component.html",
  styleUrl: "./checkbox-list.component.scss",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxListComponent),
      multi: true,
    },
  ],
})
export class CheckboxListComponent implements ControlValueAccessor {
  @Input() id = "";
  @Input() label = "";
  @Input() options: SelectOption[] = [];
  @Input() disabledOptions: string[] = [];
  @Input() disabled = false;

  value: string[] = [];

  private onChange: (value: string[]) => void = () => {};
  onTouched: () => void = () => {};

  get errorId(): string {
    return `${this.id}Error`;
  }

  writeValue(value: string[] | null): void {
    this.value = value ?? [];
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  isSelected(option: SelectOption): boolean {
    return this.value.includes(option.value);
  }

  isOptionDisabled(option: SelectOption): boolean {
    return this.disabled || this.disabledOptions.includes(option.value);
  }

  toggle(option: SelectOption): void {
    if (this.isOptionDisabled(option)) return;

    this.value = this.isSelected(option)
      ? this.value.filter((value) => value !== option.value)
      : [...this.value, option.value];
    this.onChange(this.value);
  }
}
