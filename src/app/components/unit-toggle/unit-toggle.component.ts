import { Component } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";

@Component({
  selector: "app-unit-toggle",
  imports: [],
  templateUrl: "./unit-toggle.component.html",
  styleUrl: "./unit-toggle.component.scss",
})
export class UnitToggleComponent {
  constructor(public units: UnitPreferenceService) {}
}
