import { Component } from "@angular/core";
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";

import { AuthService } from "../../services/auth.service";

@Component({
  selector: "app-login",
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.scss",
})
export class LoginComponent {
  readonly credentialsForm = new FormGroup({
    email: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl("", {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  constructor(public auth: AuthService) {}

  async login(): Promise<void> {
    if (!this.validateCredentials()) return;

    const { email, password } = this.credentialsForm.getRawValue();
    await this.auth.login(email, password);
  }

  async register(): Promise<void> {
    if (!this.validateCredentials()) return;

    const { email, password } = this.credentialsForm.getRawValue();
    await this.auth.register(email, password);
  }

  async resetPassword(): Promise<void> {
    const email = this.credentialsForm.controls.email;
    email.markAsTouched();

    if (email.invalid) return;

    await this.auth.resetPassword(email.getRawValue());
  }

  private validateCredentials(): boolean {
    this.credentialsForm.markAllAsTouched();
    return this.credentialsForm.valid;
  }
}
