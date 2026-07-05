import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { Auth } from "@angular/fire/auth";
import { AuthService } from "../services/auth.service";

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.redirectResultReady;
  await auth.authStateReady();
  return auth.currentUser !== null ? true : router.createUrlTree(["/login"]);
};
