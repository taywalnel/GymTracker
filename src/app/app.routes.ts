import { Routes } from "@angular/router";
import { TodayWorkoutComponent } from "./components/today-workout/today-workout.component";
import { HistoryComponent } from "./components/history/history.component";
import { SessionDetailComponent } from "./components/session-detail/session-detail.component";
import { ProgramHomeComponent } from "./components/program/program-home/program-home.component";
import { WorkoutListComponent } from "./components/program/workout-list/workout-list.component";
import { ExercisesListComponent } from "./components/program/exercises-list/exercises-list.component";
import { ExerciseEditorComponent } from "./components/program/exercise-editor/exercise-editor.component";
import { AddExerciseComponent } from "./components/program/add-exercise/add-exercise.component";
import { EditExerciseComponent } from "./components/program/edit-exercise/edit-exercise.component";
import { AccountComponent } from "./components/account/account.component";
import { LoginComponent } from "./components/login/login.component";
import { CurrentExercisePageComponent } from "./components/current-exercise-page/current-exercise-page.component";
import { CurrentWorkoutComponent } from "./components/current-workout/current-workout.component";
import { ExerciseHistoryPageComponent } from "./components/exercise-history-page/exercise-history-page.component";
import { BodyWeightComponent } from "./components/body-weight/body-weight.component";
import { WorkoutDetailComponent } from "./components/program/workout-detail/workout-detail.component";
import { CreateRoutineComponent } from "./components/program/create-routine/create-routine.component";
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
    path: "current-workout/:workoutId/add-exercise",
    component: AddExerciseComponent,
    title: "Add Exercise — Gym Tracker",
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
    path: "body-weight",
    component: BodyWeightComponent,
    title: "Body Weight — Gym Tracker",
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
    title: "Exercise Progress — Gym Tracker",
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
    path: "program/exercises/new",
    component: ExerciseEditorComponent,
    title: "New Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/exercises/edit/:id",
    component: ExerciseEditorComponent,
    title: "Edit Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/exercises",
    component: ExercisesListComponent,
    title: "Exercises — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit/:id/add-exercise",
    component: AddExerciseComponent,
    title: "Add Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/edit/:id/exercise/:exerciseId",
    component: EditExerciseComponent,
    title: "Edit Exercise — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/new",
    component: CreateRoutineComponent,
    title: "New Routine — Gym Tracker",
    canActivate: [authGuard],
  },
  {
    path: "program/workout/:id",
    component: WorkoutDetailComponent,
    title: "Routine — Gym Tracker",
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
