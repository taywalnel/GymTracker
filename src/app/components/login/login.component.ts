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
    // Reactive path: covers popup sign-in and already-authenticated users.
    effect(() => {
      if (this.auth.currentUser()) {
        void this.router.navigate(["/"]);
      }
    });

    // Redirect path: runs after getRedirectResult() completes.
    // Uses the synchronous Firebase auth property rather than the Angular signal
    // because the signal (toSignal/onAuthStateChanged) updates in a later microtask,
    // after getRedirectResult() has already synchronously set auth.currentUser.
    void this.auth.redirectResultReady.then(() => {
      if (this.firebaseAuth.currentUser) {
        void this.router.navigate(["/"]);
      }
    });
  }
}
