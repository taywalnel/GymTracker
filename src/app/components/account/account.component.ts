import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { ButtonComponent } from "../button/button.component";
import { PageHeaderComponent } from "../page-header/page-header.component";
import { UnitToggleComponent } from "../unit-toggle/unit-toggle.component";

const INSTALL_HINT_KEY = "gym:installHintDismissed";

@Component({
  selector: "app-account",
  imports: [ButtonComponent, PageHeaderComponent, UnitToggleComponent],
  templateUrl: "./account.component.html",
  styleUrl: "./account.component.scss",
})
export class AccountComponent {
  activeTab = "Account";
  showInstallHint = shouldShowInstallHint();

  constructor(public auth: AuthService) {}

  selectTab(tab: string): void {
    this.activeTab = tab;
  }

  dismissInstallHint(): void {
    this.showInstallHint = false;
    try {
      localStorage.setItem(INSTALL_HINT_KEY, "true");
    } catch (e) {
      // ignore storage errors
    }
  }
}

/**
 * iOS has no install prompt, so explain Add to Home Screen to iPhone users
 * who haven't installed the app or dismissed the hint.
 */
function shouldShowInstallHint(): boolean {
  try {
    if (localStorage.getItem(INSTALL_HINT_KEY)) return false;
  } catch (e) {
    // ignore storage errors
  }
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const isInstalled =
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  return isIos && !isInstalled;
}
