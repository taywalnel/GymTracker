import { Component } from "@angular/core";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { UnitToggleComponent } from "../unit-toggle/unit-toggle.component";

@Component({
  selector: "app-settings",
  imports: [PageHeaderComponent, UnitToggleComponent],
  templateUrl: "./settings.component.html",
  styleUrl: "./settings.component.scss",
})
export class SettingsComponent {}
