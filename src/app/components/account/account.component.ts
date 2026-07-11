import { Component } from "@angular/core";
import { AuthService } from "../../services/auth.service";
import { ButtonComponent } from "../button/button.component";

@Component({
    selector: "app-account",
    imports: [ButtonComponent],
    templateUrl: "./account.component.html",
    styleUrl: "./account.component.scss"
})
export class AccountComponent {
  constructor(public auth: AuthService) {}
}
