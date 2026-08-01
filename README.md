# Gym Tracker

A mobile-first web app that shows you the correct workout for today (based on
a 3-day rotation: Chest/Triceps → Shoulders → Back/Biceps), lets you log sets
and reps with large tap-friendly stepper controls, and keeps history per
exercise so you can see what you lifted last time.

The app uses Firebase Authentication and Cloud Firestore. Data is isolated per
authenticated user under `users/{uid}`.

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

## Firestore data model

```text
users/{uid}/
  { schemaVersion: 2 }
  exercises/{exerciseId}  { id, name }
  routines/{routineId}    { id, name, rotationOrder, exercises[] }
  sessions/{sessionId}    { id, routineId, routineName, date, exerciseLogs[] }
```

Routine `exercises[]` items store only the exercise ID and routine-specific
targets: `targetWeightKg`, `targetReps`, `targetSets`, and `order`. The display
name comes from the reusable exercise catalog. Renaming an exercise therefore
updates its name across every active routine that references it.

Each historical `sessions[].exerciseLogs[]` item retains `exerciseName` as an
immutable snapshot. A later catalog rename never changes workout history.

## Exercise Catalog Migration

Existing Firestore data may contain legacy routine exercises with an embedded
`name`. The migration creates catalog documents and removes only those embedded
routine names. It never writes to `sessions`. It also writes `schemaVersion: 2`
to `users/{uid}`, so the user document is materialized and its `exercises`,
`routines`, and `sessions` child collections are consistently browseable in the
Firestore Console.

1. Export Firestore before applying any writes:

```bash
gcloud firestore export gs://YOUR_BACKUP_BUCKET/gymtracker-before-exercise-catalog
```

2. Authenticate the local Admin SDK with an account that can read and write
   project `gymtracker-8fc1b`:

```bash
gcloud auth application-default login
gcloud config set project gymtracker-8fc1b
```

3. Run a dry run for one user, then inspect the reported catalog and routine
   counts. Replace `USER_ID` with the Firebase Authentication UID:

```bash
npm run migrate:exercise-catalog -- --user=USER_ID
```

4. Apply the migration only after confirming the backup and dry-run output:

```bash
npm run migrate:exercise-catalog -- --user=USER_ID --apply
npm run verify:exercise-catalog -- --user=USER_ID
```

5. To migrate and verify every user, omit `--user=USER_ID`:

```bash
npm run migrate:exercise-catalog -- --apply
npm run verify:exercise-catalog
```

The migration stops on inconsistent data, including one exercise ID with
different names. Resolve such conflicts manually before applying it. The
scripts are idempotent: reruns preserve catalog documents, remove any remaining
legacy routine names, materialize the user document, and verify catalog
references plus immutable session names.

## Known simplifications in this pass

- In-progress workout state is stored in browser session storage; it is not
  written to Firestore until the workout is completed.
- Editing/deleting past history entries isn't built yet — only viewing.
- Desktop/tablet layout isn't a design goal for this pass — the app is
  optimized exclusively for mobile viewport widths per your request, so wider
  screens will just show the same narrow column centered with empty space
  on either side.
