import { Injectable, signal, computed } from "@angular/core";
import {
  Auth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  user,
} from "@angular/fire/auth";
import { Router } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly _user = toSignal(user(this.auth), { initialValue: null });

  readonly currentUser = this._user;
  readonly isLoggedIn = computed(() => this._user() !== null);
  readonly isLoading = signal(false);
  readonly authError = signal<string | null>(null);

  constructor(
    private auth: Auth,
    private router: Router,
  ) {}

  // Firebase Console > Authentication > Sign-in method > Email/Password must be enabled.
  async register(email: string, password: string): Promise<void> {
    await this.authenticate(() =>
      createUserWithEmailAndPassword(this.auth, email, password),
    );
  }

  async login(email: string, password: string): Promise<void> {
    await this.authenticate(() =>
      signInWithEmailAndPassword(this.auth, email, password),
    );
  }

  async resetPassword(email: string): Promise<void> {
    this.authError.set(null);
    this.isLoading.set(true);

    try {
      await sendPasswordResetEmail(this.auth, email);
    } catch (error) {
      this.authError.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    this.authError.set(null);
    this.isLoading.set(true);

    try {
      await signOut(this.auth);
      await this.router.navigate(["/login"]);
    } catch (error) {
      this.authError.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private async authenticate(action: () => Promise<unknown>): Promise<void> {
    this.authError.set(null);
    this.isLoading.set(true);

    try {
      await action();
      await this.router.navigate(["/"]);
    } catch (error) {
      this.authError.set(this.getErrorMessage(error));
    } finally {
      this.isLoading.set(false);
    }
  }

  private getErrorMessage(error: unknown): string {
    switch ((error as { code?: string }).code) {
      case "auth/email-already-in-use":
        return "An account already exists for this email address.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/weak-password":
        return "Password must be at least 6 characters long.";
      case "auth/invalid-credential":
      case "auth/user-not-found":
      case "auth/wrong-password":
        return "Incorrect email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Please wait a moment and try again.";
      case "auth/operation-not-allowed":
        return "Email/password sign-in is not enabled for this Firebase project.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
}
