import { Routes } from "@angular/router";
import { TodayWorkoutComponent } from "./components/today-workout/today-workout.component";
import { HistoryComponent } from "./components/history/history.component";
import { SessionDetailComponent } from "./components/session-detail/session-detail.component";
import { ProgramComponent } from "./components/program/program.component";
import { ProgramEditorComponent } from "./components/program/program-editor.component";
import { SettingsComponent } from "./components/settings/settings.component";
import { AccountComponent } from "./components/account/account.component";
import { LoginComponent } from "./components/login/login.component";
import { authGuard } from "./guards/auth.guard";

export const routes: Routes = [
  { path: "login", component: LoginComponent, title: "Sign In — Gym Tracker" },
  {
    path: "",
    component: TodayWorkoutComponent,
    title: "Today — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "workout/:routineId",
    component: TodayWorkoutComponent,
    title: "Workout — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "history",
    component: HistoryComponent,
    title: "History — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "history/session/:sessionId",
    component: SessionDetailComponent,
    title: "Session — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "history/:exerciseId",
    component: HistoryComponent,
    title: "History — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program",
    component: ProgramComponent,
    title: "Program — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/edit",
    component: ProgramEditorComponent,
    title: "Create Routine — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/edit/:id",
    component: ProgramEditorComponent,
    title: "Edit Routine — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "settings",
    component: SettingsComponent,
    title: "Settings — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "account",
    component: AccountComponent,
    title: "Account — Gym Tracker",
    canActivate: [authGuard],
  },
  { path: "**", redirectTo: "" },
];
