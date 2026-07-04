import { Routine, WorkoutSession } from '../models/workout.models';

/**
 * The three routines in rotation order. This is the static program definition.
 * IDs are stable strings so history/logs can reference them reliably.
 * All weights are in kilograms (the unit the source data was recorded in).
 */
export const MOCK_ROUTINES: Routine[] = [
  {
    id: 'routine-chest-tri',
    name: 'Chest / Triceps',
    rotationOrder: 0,
    exercises: [
      { id: 'ex-flat-db', name: 'Flat DB Press', targetWeightKg: 35, targetReps: 8, targetSets: 3, order: 0 },
      { id: 'ex-incline-db', name: 'Incline DB Press', targetWeightKg: 30, targetReps: 10, targetSets: 3, order: 1 },
      { id: 'ex-machine-press', name: 'Machine Press', targetWeightKg: 70, targetReps: 12, targetSets: 3, order: 2 },
      { id: 'ex-cable-flys', name: 'Cable Flys', targetWeightKg: 15, targetReps: 12, targetSets: 3, order: 3 },
      { id: 'ex-tricep-rope', name: 'Tricep Rope', targetWeightKg: 15, targetReps: 15, targetSets: 3, order: 4 },
      { id: 'ex-tricep-machine', name: 'Tricep Machine', targetWeightKg: 35, targetReps: 12, targetSets: 3, order: 5 },
    ],
  },
  {
    id: 'routine-shoulders',
    name: 'Shoulders',
    rotationOrder: 1,
    exercises: [
      { id: 'ex-shoulder-db', name: 'Dumbbell Shoulder Press', targetWeightKg: 25, targetReps: 10, targetSets: 3, order: 0 },
      { id: 'ex-standing-plate', name: 'Standing Plate Loaded Press', targetWeightKg: 20, targetReps: 12, targetSets: 3, order: 1 },
      { id: 'ex-seated-lateral', name: 'Seated Side Lateral', targetWeightKg: 12.5, targetReps: 15, targetSets: 4, order: 2 },
      { id: 'ex-reverse-fly', name: 'Reverse Fly', targetWeightKg: 50, targetReps: 12, targetSets: 3, order: 3 },
      { id: 'ex-ab-leg-raises', name: 'Ab Leg Raises', targetWeightKg: 0, targetReps: 15, targetSets: 3, order: 4 },
    ],
  },
  {
    id: 'routine-back-bi',
    name: 'Back / Biceps',
    rotationOrder: 2,
    exercises: [
      { id: 'ex-lat-corner', name: 'Lat Corner Grip Bar', targetWeightKg: 66, targetReps: 12, targetSets: 4, order: 0 },
      { id: 'ex-supported-tbar', name: 'Supported T-Bar Row', targetWeightKg: 25, targetReps: 12, targetSets: 4, order: 1 },
      { id: 'ex-machine-row', name: 'Machine Row', targetWeightKg: 70, targetReps: 12, targetSets: 3, order: 2 },
      { id: 'ex-seated-curl', name: 'Seated Curl', targetWeightKg: 10, targetReps: 15, targetSets: 3, order: 3 },
      { id: 'ex-machine-curl', name: 'Machine Curl', targetWeightKg: 25, targetReps: 15, targetSets: 3, order: 4 },
    ],
  },
];

/**
 * Historical sessions, transcribed from the user's existing notes plus an
 * earlier rotation cycle added so the calendar history view has more than
 * one week of data to highlight.
 */
export const MOCK_SESSIONS: WorkoutSession[] = [
  // --- Earlier cycle, for calendar density ---
  {
    id: 'session-101',
    routineId: 'routine-chest-tri',
    routineName: 'Chest / Triceps',
    date: '2026-06-09',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-flat-db',
        exerciseName: 'Flat DB Press',
        completedSets: [
          { setNumber: 1, reps: 8, weightKg: 32.5 },
          { setNumber: 2, reps: 7, weightKg: 32.5 },
          { setNumber: 3, reps: 6, weightKg: 32.5 },
        ],
      },
      {
        exerciseId: 'ex-incline-db',
        exerciseName: 'Incline DB Press',
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 27.5 },
          { setNumber: 2, reps: 9, weightKg: 27.5 },
          { setNumber: 3, reps: 7, weightKg: 27.5 },
        ],
      },
      {
        exerciseId: 'ex-cable-flys',
        exerciseName: 'Cable Flys',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 12.5 },
          { setNumber: 2, reps: 11, weightKg: 12.5 },
        ],
      },
      {
        exerciseId: 'ex-tricep-rope',
        exerciseName: 'Tricep Rope',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 12.5 },
          { setNumber: 2, reps: 14, weightKg: 12.5 },
          { setNumber: 3, reps: 12, weightKg: 12.5 },
        ],
      },
    ],
  },
  {
    id: 'session-102',
    routineId: 'routine-shoulders',
    routineName: 'Shoulders',
    date: '2026-06-11',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-shoulder-db',
        exerciseName: 'Dumbbell Shoulder Press',
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 22.5 },
          { setNumber: 2, reps: 8, weightKg: 22.5 },
          { setNumber: 3, reps: 7, weightKg: 22.5 },
        ],
      },
      {
        exerciseId: 'ex-standing-plate',
        exerciseName: 'Standing Plate Loaded Press',
        completedSets: [
          { setNumber: 1, reps: 9, weightKg: 20 },
          { setNumber: 2, reps: 9, weightKg: 20 },
          { setNumber: 3, reps: 8, weightKg: 20 },
        ],
      },
      {
        exerciseId: 'ex-seated-lateral',
        exerciseName: 'Seated Side Lateral',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 10 },
          { setNumber: 2, reps: 12, weightKg: 10 },
          { setNumber: 3, reps: 11, weightKg: 10 },
        ],
      },
      {
        exerciseId: 'ex-ab-leg-raises',
        exerciseName: 'Ab Leg Raises',
        completedSets: [
          { setNumber: 1, reps: 14, weightKg: 0 },
          { setNumber: 2, reps: 12, weightKg: 0 },
          { setNumber: 3, reps: 10, weightKg: 0 },
        ],
      },
    ],
  },
  {
    id: 'session-103',
    routineId: 'routine-back-bi',
    routineName: 'Back / Biceps',
    date: '2026-06-13',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-lat-corner',
        exerciseName: 'Lat Corner Grip Bar',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 62 },
          { setNumber: 2, reps: 10, weightKg: 62 },
          { setNumber: 3, reps: 8, weightKg: 62 },
          { setNumber: 4, reps: 7, weightKg: 62 },
        ],
      },
      {
        exerciseId: 'ex-supported-tbar',
        exerciseName: 'Supported T-Bar Row',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 22.5 },
          { setNumber: 2, reps: 11, weightKg: 22.5 },
          { setNumber: 3, reps: 9, weightKg: 22.5 },
          { setNumber: 4, reps: 8, weightKg: 22.5 },
        ],
      },
      {
        exerciseId: 'ex-machine-row',
        exerciseName: 'Machine Row',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 65 },
          { setNumber: 2, reps: 11, weightKg: 65 },
          { setNumber: 3, reps: 10, weightKg: 65 },
        ],
      },
      {
        exerciseId: 'ex-seated-curl',
        exerciseName: 'Seated Curl',
        completedSets: [
          { setNumber: 1, reps: 14, weightKg: 9 },
          { setNumber: 2, reps: 11, weightKg: 9 },
          { setNumber: 3, reps: 9, weightKg: 9 },
        ],
      },
      {
        exerciseId: 'ex-machine-curl',
        exerciseName: 'Machine Curl',
        completedSets: [
          { setNumber: 1, reps: 14, weightKg: 22.5 },
          { setNumber: 2, reps: 10, weightKg: 22.5 },
        ],
      },
    ],
  },
  // --- Most recent cycle, transcribed directly from the user's notes ---
  {
    id: 'session-001',
    routineId: 'routine-chest-tri',
    routineName: 'Chest / Triceps',
    date: '2026-06-23',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-flat-db',
        exerciseName: 'Flat DB Press',
        completedSets: [
          { setNumber: 1, reps: 8, weightKg: 35 },
          { setNumber: 2, reps: 8, weightKg: 35 },
          { setNumber: 3, reps: 6, weightKg: 35 },
        ],
      },
      {
        exerciseId: 'ex-incline-db',
        exerciseName: 'Incline DB Press',
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 30 },
          { setNumber: 2, reps: 8, weightKg: 30 },
          { setNumber: 3, reps: 6, weightKg: 30 },
        ],
      },
      {
        exerciseId: 'ex-machine-press',
        exerciseName: 'Machine Press',
        completedSets: [],
      },
      {
        exerciseId: 'ex-cable-flys',
        exerciseName: 'Cable Flys',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 15 },
          { setNumber: 2, reps: 12, weightKg: 15 },
        ],
      },
      {
        exerciseId: 'ex-tricep-rope',
        exerciseName: 'Tricep Rope',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 15 },
          { setNumber: 2, reps: 15, weightKg: 15 },
          { setNumber: 3, reps: 15, weightKg: 15 },
        ],
      },
      {
        exerciseId: 'ex-tricep-machine',
        exerciseName: 'Tricep Machine',
        completedSets: [],
      },
    ],
  },
  {
    id: 'session-002',
    routineId: 'routine-shoulders',
    routineName: 'Shoulders',
    date: '2026-06-24',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-shoulder-db',
        exerciseName: 'Dumbbell Shoulder Press',
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 25 },
          { setNumber: 2, reps: 8, weightKg: 25 },
          { setNumber: 3, reps: 6, weightKg: 25 },
        ],
      },
      {
        exerciseId: 'ex-standing-plate',
        exerciseName: 'Standing Plate Loaded Press',
        completedSets: [
          { setNumber: 1, reps: 10, weightKg: 20 },
          { setNumber: 2, reps: 11, weightKg: 20 },
          { setNumber: 3, reps: 11, weightKg: 20 },
        ],
      },
      {
        exerciseId: 'ex-seated-lateral',
        exerciseName: 'Seated Side Lateral',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 12.5 },
          { setNumber: 2, reps: 12, weightKg: 12.5 },
          { setNumber: 3, reps: 12, weightKg: 12.5 },
        ],
      },
      {
        exerciseId: 'ex-reverse-fly',
        exerciseName: 'Reverse Fly',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 50 },
          { setNumber: 2, reps: 12, weightKg: 50 },
        ],
      },
      {
        exerciseId: 'ex-ab-leg-raises',
        exerciseName: 'Ab Leg Raises',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 0 },
          { setNumber: 2, reps: 15, weightKg: 0 },
          { setNumber: 3, reps: 11, weightKg: 0 },
        ],
      },
    ],
  },
  {
    id: 'session-003',
    routineId: 'routine-back-bi',
    routineName: 'Back / Biceps',
    date: '2026-06-25',
    inProgress: false,
    exerciseLogs: [
      {
        exerciseId: 'ex-lat-corner',
        exerciseName: 'Lat Corner Grip Bar',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 66 },
          { setNumber: 2, reps: 10, weightKg: 66 },
          { setNumber: 3, reps: 9, weightKg: 66 },
          { setNumber: 4, reps: 8, weightKg: 66 },
        ],
      },
      {
        exerciseId: 'ex-supported-tbar',
        exerciseName: 'Supported T-Bar Row',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 25 },
          { setNumber: 2, reps: 12, weightKg: 25 },
          { setNumber: 3, reps: 10, weightKg: 25 },
          { setNumber: 4, reps: 9, weightKg: 25 },
        ],
      },
      {
        exerciseId: 'ex-machine-row',
        exerciseName: 'Machine Row',
        completedSets: [
          { setNumber: 1, reps: 12, weightKg: 70 },
          { setNumber: 2, reps: 12, weightKg: 70 },
          { setNumber: 3, reps: 11, weightKg: 70 },
        ],
      },
      {
        exerciseId: 'ex-seated-curl',
        exerciseName: 'Seated Curl',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 10 },
          { setNumber: 2, reps: 11, weightKg: 10 },
          { setNumber: 3, reps: 10, weightKg: 10 },
        ],
      },
      {
        exerciseId: 'ex-machine-curl',
        exerciseName: 'Machine Curl',
        completedSets: [
          { setNumber: 1, reps: 15, weightKg: 25 },
          { setNumber: 2, reps: 11, weightKg: 25 },
        ],
      },
    ],
  },
];
