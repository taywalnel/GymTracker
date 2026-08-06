import { Routes } from "@angular/router";
import { TodayWorkoutComponent } from "./components/today-workout/today-workout.component";
import { HistoryComponent } from "./components/history/history.component";
import { SessionDetailComponent } from "./components/session-detail/session-detail.component";
import { ProgramHomeComponent } from "./components/program/program-home/program-home.component";
import { WorkoutListComponent } from "./components/program/workout-list/workout-list.component";
import { ExercisesListComponent } from "./components/program/exercises-list/exercises-list.component";
import { WorkoutEditorComponent } from "./components/program/workout-editor/workout-editor.component";
import { AddExerciseComponent } from "./components/program/add-exercise/add-exercise.component";
import { AccountComponent } from "./components/account/account.component";
import { LoginComponent } from "./components/login/login.component";
import { CurrentExercisePageComponent } from "./components/current-exercise-page/current-exercise-page.component";
import { CurrentWorkoutComponent } from "./components/current-workout/current-workout.component";
import { ExerciseHistoryPageComponent } from "./components/exercise-history-page/exercise-history-page.component";
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
    path: "current-workout/:workoutId",
    component: CurrentWorkoutComponent,
    title: "Workout — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "current-workout/:workoutId/:exerciseId",
    component: CurrentExercisePageComponent,
    title: "Exercise — Gym Tracker",
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
    path: "history/exercises/:exerciseId",
    component: ExerciseHistoryPageComponent,
    title: "Exercise History — Gym Tracker",
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
    component: ProgramHomeComponent,
    title: "Program — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workouts",
    component: WorkoutListComponent,
    title: "Workouts — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/exercises",
    component: ExercisesListComponent,
    title: "Exercises — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit",
    component: WorkoutEditorComponent,
    title: "Create Routine — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit/add-exercise",
    component: AddExerciseComponent,
    title: "Add Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit/edit-exercise",
    component: AddExerciseComponent,
    title: "Edit Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit/:id",
    component: WorkoutEditorComponent,
    title: "Edit Routine — Gym Tracker",
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
