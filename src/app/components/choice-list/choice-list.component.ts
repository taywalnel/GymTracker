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
  @Input() columns = 2;
  // Grow to fill the remaining height of a flex column parent and scroll the
  // choices (not the label) when they don't fit.
  @HostBinding("class.fill") @Input() fill = false;
  @Output() valueChange = new EventEmitter<T>();

  choose(value: T): void {
    this.value = value;
    this.valueChange.emit(value);
  }
}
