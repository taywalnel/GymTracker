import { Component } from "@angular/core";
import { UnitPreferenceService } from "../../services/unit-preference.service";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-settings",
  standalone: true,
  imports: [],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.scss",
})
export class SettingsComponent {
  constructor(
    public units: UnitPreferenceService,
    public auth: AuthService,
  ) {}
}
