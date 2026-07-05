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

  constructor(
    private auth: Auth,
    private router: Router,
  ) {
    this.handleRedirectResult();
  }

  private isMobile(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  private async handleRedirectResult(): Promise<void> {
    const result = await getRedirectResult(this.auth);
    if (result?.user) {
      await this.router.navigate(["/"]);
    }
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    if (this.isMobile()) {
      await signInWithRedirect(this.auth, provider);
    } else {
      await signInWithPopup(this.auth, provider);
      await this.router.navigate(["/"]);
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.auth);
    await this.router.navigate(["/login"]);
  }
}
