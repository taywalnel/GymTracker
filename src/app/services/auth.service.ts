import { Injectable, signal, computed } from "@angular/core";
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
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
  readonly redirectResultReady: Promise<void>;

  constructor(
    private auth: Auth,
    private router: Router,
  ) {
    this.redirectResultReady = this.handleRedirectResult();
  }

  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  private async handleRedirectResult(): Promise<void> {
    try {
      await getRedirectResult(this.auth);
    } catch (error: any) {
      console.error("Redirect result error:", error);
      this.authError.set(error?.message ?? "Sign-in failed. Please try again.");
    } finally {
      this.isLoading.set(false);
    }
  }

  async signInWithGoogle(): Promise<void> {
    this.authError.set(null);
    this.isLoading.set(true);
    try {
      const provider = new GoogleAuthProvider();
      if (this.isMobile()) {
        await signInWithRedirect(this.auth, provider);
      } else {
        await signInWithPopup(this.auth, provider);
        await this.router.navigate(["/"]);
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);
      this.authError.set(error?.message ?? "Sign-in failed. Please try again.");
      this.isLoading.set(false);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(["/login"]);
  }
}
