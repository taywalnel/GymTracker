import { Component } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";

@Component({
    selector: "app-settings",
    imports: [],
    templateUrl: "./settings.component.html",
    styleUrl: "./settings.component.scss"
})
export class SettingsComponent {
  constructor(public units: UnitPreferenceService) {}
}
