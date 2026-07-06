import { Component, effect, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router } from "@angular/router";
import { Auth } from "@angular/fire/auth";
import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  private readonly firebaseAuth = inject(Auth);

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {
    effect(() => {
      if (this.auth.currentUser()) {
        void this.router.navigate(["/"]);
        return;
      }

      void this.redirectIfAuthenticated();
    });
  }

  private async redirectIfAuthenticated(): Promise<void> {
    await this.auth.redirectResultReady;
    await this.firebaseAuth.authStateReady();

    if (this.auth.currentUser()) {
      await this.router.navigate(["/"]);
    }
  }
}
