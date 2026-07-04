import { Routes } from '@angular/router';
import { TodayWorkoutComponent } from './components/today-workout/today-workout.component';
import { HistoryComponent } from './components/history/history.component';

export const routes: Routes = [
  { path: '', component: TodayWorkoutComponent, title: 'Today — Gym Tracker' },
  { path: 'history', component: HistoryComponent, title: 'History — Gym Tracker' },
  { path: 'history/:exerciseId', component: HistoryComponent, title: 'History — Gym Tracker' },
  { path: '**', redirectTo: '' },
];
