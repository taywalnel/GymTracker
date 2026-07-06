import { Component, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  constructor(
    public auth: AuthService,
    private router: Router,
  ) {
    effect(() => {
      if (this.auth.currentUser()) {
        void this.router.navigate(["/"]);
      }
    });
  }
}
