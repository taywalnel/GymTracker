import { Component } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { PageHeaderComponent } from "../page-header/page-header.component";

@Component({
  selector: "app-settings",
  imports: [PageHeaderComponent],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.scss",
})
export class SettingsComponent {
  constructor(public units: UnitPreferenceService) {}
}
