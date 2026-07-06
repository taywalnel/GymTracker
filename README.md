# Gym Tracker

A mobile-first web app that shows you the correct workout for today (based on
a 3-day rotation: Chest/Triceps → Shoulders → Back/Biceps), lets you log sets
and reps with large tap-friendly stepper controls, and keeps history per
exercise so you can see what you lifted last time.

This build is **frontend-only with mock data** — nothing is persisted to a real
database yet. It's structured so that swapping in a real backend later is a
contained change (see "Moving to a real backend" below).

## Designed for mobile, exclusively

This app assumes you're using it on a phone, mid-workout, with one hand and
maybe chalky/sweaty fingers. That shaped some specific decisions:

- **No text input fields anywhere.** Every rep/weight value is set with large
  stepper buttons (− / value / +), each a minimum 48×48px tap target. No
  on-screen keyboard ever pops up while logging a set.
- **First tap jumps to target.** Tapping "+" on a fresh set jumps straight to
  the planned rep count (e.g. target is 10 reps → first tap shows 10), since
  most sets go to plan; further taps nudge up or down by 1 from there.
- **Bottom tab bar**, not a top nav — thumb-reachable navigation.
- **Sticky "finish session" button**, pinned just above the tab bar, so it's
  always reachable without scrolling to the bottom of a long exercise list.
- **Vertical-only layouts** — the rotation tracker, set rows, and history
  rows all stack top-to-bottom rather than relying on horizontal space.
- All interactive elements use `:active` (touch) states, not `:hover`.
- Respects safe-area insets (notches/home indicators) and disables
  pinch-zoom-on-input-focus quirks.

## Getting started

Requires Node.js 18+ and npm.

```bash
npm install
npm start
```

Then open http://localhost:4200. For the truest sense of the design, open
dev tools and switch to a mobile device emulation (e.g. iPhone), or load it
on an actual phone on your local network.

## Firebase auth redirect requirement

Google sign-in on mobile uses Firebase Auth's redirect flow. That flow depends
on Firebase Hosting's reserved helper endpoints under `/__/auth/*` and
`/__/firebase/init.json` on the configured `authDomain`.

This project uses `gymtracker-8fc1b.firebaseapp.com` as its auth domain. If
that domain has not been provisioned via Firebase Hosting, mobile Google sign-in
will return to the app but fail to restore the session because the helper will
404 on `/__/firebase/init.json`.

To provision the required endpoints for this repo:

```bash
npm run build
firebase deploy --only hosting
```

If you're testing from `http://localhost:4200`, also make sure that origin is
listed in Firebase Authentication's authorized domains.

## How the rotation logic works

`WorkoutService.getTodayWorkout()` looks at the most recently completed session
(by date), finds that session's routine, and returns the _next_ routine in
`rotationOrder` (wrapping back to 0 after the last one). If there's no history
at all, it starts at rotation order 0 (Chest/Triceps).

This means: log a Back/Biceps session today, and the app will show you
Chest/Triceps next time you open it — no matter what day of the week it is.
The rotation is driven purely by "what did I last complete," not by calendar day.

## Project structure

```
src/app/
  models/
    workout.models.ts       — Routine, ExercisePrescription, WorkoutSession, etc.
  services/
    workout.service.ts      — the data access boundary (see below)
    mock-data.ts            — seed data transcribed from your notes app
  components/
    today-workout/          — main landing page: shows today's routine + logging
    exercise-card/           — one exercise: target, last time, stepper inputs
    rotation-tracker/        — the vertical loop visual (Chest/Tri → Shoulders → Back/Bi)
    history/                 — session list (collapsible) + per-exercise drill-down
```

## Moving to a real backend

Every component talks only to `WorkoutService`, never directly to the mock
arrays. The service currently looks like this:

```ts
getTodayWorkout(): Observable<TodayWorkout> {
  // ...computed from in-memory arrays...
  return of(result).pipe(delay(150));
}
```

To go live, you'd:

1. Add `HttpClientModule` / `provideHttpClient()` to `app.config.ts`.
2. Replace each method body in `workout.service.ts` with an HTTP call, e.g.:
   ```ts
   getTodayWorkout(): Observable<TodayWorkout> {
     return this.http.get<TodayWorkout>('/api/workouts/today');
   }
   ```
3. Move the "next routine in rotation" logic (`determineNextRoutine`) to the
   backend, since that's really server-side business logic once multiple
   devices/sessions are involved.
4. Add a real `saveSession` endpoint (`POST /api/sessions`) and have the
   backend persist to your database of choice.

No component code needs to change for this — they all depend on the
`WorkoutService` method signatures and the model interfaces in
`models/workout.models.ts`, not on how the data is fetched.

## Known simplifications in this pass

- No auth yet (you said solo use — login can be added later without
  restructuring, e.g. a simple guard + session cookie).
- "Mark exercise done" / "Finish session" state lives only in the browser tab;
  refreshing the page mid-session will lose in-progress (unsaved) sets. Once
  there's a backend, autosaving per-set as you type is a natural addition.
- Editing/deleting past history entries isn't built yet — only viewing.
- Desktop/tablet layout isn't a design goal for this pass — the app is
  optimized exclusively for mobile viewport widths per your request, so wider
  screens will just show the same narrow column centered with empty space
  on either side.
