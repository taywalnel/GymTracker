import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from "@angular/core";
import { ButtonComponent } from "../button/button.component";

export interface ChoiceOption<T extends string = string> {
  value: T;
  label: string;
}

@Component({
  selector: "app-choice-list",
  imports: [ButtonComponent],
  templateUrl: "./choice-list.component.html",
  styleUrl: "./choice-list.component.scss",
})
export class ChoiceListComponent<T extends string = string> {
  @Input() label = "";
  @Input() options: ChoiceOption<T>[] = [];
  @Input() value: T | null = null;
  /** Lets several options be chosen; they're read and emitted as `values`. */
  @Input() multiple = false;
  @Input() values: readonly T[] = [];
  @Input() columns = 2;
  // Grow to fill the remaining height of a flex column parent and scroll the
  // choices (not the label) when they don't fit.
  @HostBinding("class.fill") @Input() fill = false;
  @Output() valueChange = new EventEmitter<T>();
  @Output() valuesChange = new EventEmitter<T[]>();

  isSelected(value: T): boolean {
    return this.multiple ? this.values.includes(value) : this.value === value;
  }

  choose(value: T): void {
    if (this.multiple) {
      // Kept in option order, whatever order they were tapped in.
      this.values = this.options
        .map((option) => option.value)
        .filter((option) =>
          option === value ? !this.values.includes(value) : this.values.includes(option),
        );
      this.valuesChange.emit([...this.values]);
      return;
    }
    this.value = value;
    this.valueChange.emit(value);
  }
}
