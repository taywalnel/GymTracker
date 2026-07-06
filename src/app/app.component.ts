import { Component } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { RestTimerService } from "./services/rest-timer.service";
import { ButtonComponent } from "./components/button/button.component";
import { TabService } from "./services/tab.service";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ButtonComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss",
})
export class AppComponent {
  constructor(
    public restTimer: RestTimerService,
    private router: Router,
    private tabService: TabService,
  ) {}

  onTodayTabClick(event: MouseEvent): void {
    // If we're already on the Today route, prevent default navigation and broadcast the click
    const url = this.router.url || "/";
    if (url === "/" || url === "") {
      event.preventDefault();
      this.tabService.notifyTodayClick();
    }
    // otherwise allow the routerLink to navigate normally
  }
}
