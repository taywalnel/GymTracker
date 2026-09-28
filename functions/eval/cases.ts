import {
  ExerciseFeedbackRequest,
  FeedbackSet,
} from "../src/feedback";

/**
 * What a case expects: "keep", or the kind of change. A rep scheme change
 * moves the reps and the weight in opposite directions.
 */
export type Expected =
  | "keep"
  | "weight-up"
  | "reps-up"
  | "down"
  | "rest"
  | "lighter-more-reps"
  | "heavier-fewer-reps";

export interface EvalCase {
  name: string;
  expected: Expected;
  request: ExerciseFeedbackRequest;
}

/** Sets at one weight against one target, e.g. sets(37.5, 8, [8, 7, 6]). */
const sets = (
  weightKg: number,
  targetReps: number | null,
  reps: number[],
): FeedbackSet[] =>
  reps.map((count) => ({
    reps: count,
    weightKg,
    ...(targetReps != null ? { targetReps } : {}),
  }));

/** Sessions newest first, a few days apart, ending a few days ago. */
const history = (...sessions: FeedbackSet[][]) =>
  sessions.map((sessionSets, index) => ({
    date: new Date(Date.now() - (3 + index * 4) * 86_400_000)
      .toISOString()
      .slice(0, 10),
    targetSets: sessionSets.length,
    sets: sessionSets,
  }));

const plan = (weightKg: number, reps: number[], restSeconds = 90) => ({
  setWeightsKg: reps.map(() => weightKg),
  setReps: reps,
  restSeconds,
});

export const CASES: EvalCase[] = [
  {
    // The real history that prompted the coaching guide.
    name: "Close to target, matching best (Flat Dumbbell Press)",
    expected: "keep",
    request: {
      exerciseName: "Flat Dumbbell Press",
      muscleGroup: "chest",
      weightStepKg: 2.5,
      current: plan(37.5, [8, 8, 8]),
      history: history(
        sets(37.5, 8, [8, 7, 6]),
        sets(37.5, 8, [8, 7, 6]),
        sets(37.5, 8, [8, 7, 6]),
        sets(37.5, 8, [8, 6, 4]),
        sets(37.5, 8, [8, 6, 6]),
        sets(35, 8, [8, 8, 8]),
      ),
    },
  },
  {
    name: "Every set hit two sessions running",
    expected: "weight-up",
    request: {
      exerciseName: "Barbell Bench Press",
      muscleGroup: "chest",
      weightStepKg: 2.5,
      current: plan(60, [8, 8, 8], 120),
      history: history(
        sets(60, 8, [8, 8, 8]),
        sets(60, 8, [8, 8, 8]),
        sets(60, 8, [8, 7, 7]),
      ),
    },
  },
  {
    name: "Beat every target by 2+ in the latest session",
    expected: "weight-up",
    request: {
      exerciseName: "Lat Pulldown",
      muscleGroup: "back",
      weightStepKg: 2.5,
      current: plan(50, [10, 10, 10]),
      history: history(
        sets(50, 10, [13, 12, 12]),
        sets(50, 10, [10, 10, 9]),
      ),
    },
  },
  {
    name: "First session after moving up",
    expected: "keep",
    request: {
      exerciseName: "Seated Dumbbell Shoulder Press",
      muscleGroup: "shoulders",
      weightStepKg: 2.5,
      current: plan(20, [10, 10, 10]),
      history: history(
        sets(20, 10, [10, 8, 7]),
        sets(17.5, 10, [10, 10, 10]),
        sets(17.5, 10, [10, 10, 10]),
      ),
    },
  },
  {
    name: "Reps rising at the current weight",
    expected: "keep",
    request: {
      exerciseName: "Romanian Deadlift",
      muscleGroup: "hamstrings",
      weightStepKg: 2.5,
      current: plan(80, [10, 10, 10], 150),
      history: history(
        sets(80, 10, [10, 9, 9]),
        sets(80, 10, [10, 9, 8]),
        sets(80, 10, [9, 8, 7]),
      ),
    },
  },
  {
    name: "Isolation lift a couple of reps short",
    expected: "keep",
    request: {
      exerciseName: "Dumbbell Lateral Raise",
      muscleGroup: "shoulders",
      weightStepKg: 1,
      current: plan(8, [12, 12, 12], 60),
      history: history(
        sets(8, 12, [12, 11, 10]),
        sets(8, 12, [12, 11, 10]),
        sets(8, 12, [11, 11, 10]),
      ),
    },
  },
  {
    name: "Stalled for five sessions",
    expected: "rest",
    request: {
      exerciseName: "Incline Dumbbell Press",
      muscleGroup: "chest",
      weightStepKg: 2.5,
      current: plan(30, [10, 10, 10], 90),
      history: history(
        sets(30, 10, [10, 8, 7]),
        sets(30, 10, [10, 8, 7]),
        sets(30, 10, [10, 9, 6]),
        sets(30, 10, [10, 8, 7]),
        sets(30, 10, [10, 8, 7]),
      ),
    },
  },
  {
    name: "Reps falling three sessions running",
    expected: "down",
    request: {
      exerciseName: "Back Squat",
      muscleGroup: "quadriceps",
      weightStepKg: 2.5,
      current: plan(100, [8, 8, 8], 180),
      history: history(
        sets(100, 8, [6, 5, 4]),
        sets(100, 8, [7, 5, 5]),
        sets(100, 8, [8, 6, 5]),
      ),
    },
  },
  {
    name: "First set well short repeatedly",
    expected: "down",
    request: {
      exerciseName: "Weighted Pull-up",
      muscleGroup: "back",
      weightStepKg: 2.5,
      current: plan(15, [8, 8, 8], 150),
      history: history(
        sets(15, 8, [5, 4, 4]),
        sets(15, 8, [5, 4, 3]),
        sets(15, 8, [6, 5, 4]),
      ),
    },
  },
  {
    name: "Old sessions without saved targets, all hit",
    expected: "weight-up",
    request: {
      exerciseName: "Leg Press",
      muscleGroup: "quadriceps",
      weightStepKg: 2.5,
      current: plan(120, [10, 10, 10]),
      history: history(
        sets(120, null, [10, 10, 10]),
        sets(120, null, [10, 10, 10]),
      ),
    },
  },
  {
    name: "Different targets per set, all hit twice",
    expected: "weight-up",
    request: {
      exerciseName: "Cable Row",
      muscleGroup: "back",
      weightStepKg: 2.5,
      current: {
        setWeightsKg: [55, 55, 55],
        setReps: [12, 10, 8],
        restSeconds: 90,
      },
      history: history(
        [
          { reps: 12, weightKg: 55, targetReps: 12 },
          { reps: 10, weightKg: 55, targetReps: 10 },
          { reps: 8, weightKg: 55, targetReps: 8 },
        ],
        [
          { reps: 12, weightKg: 55, targetReps: 12 },
          { reps: 10, weightKg: 55, targetReps: 10 },
          { reps: 9, weightKg: 55, targetReps: 8 },
        ],
      ),
    },
  },
  {
    name: "One bad day among good sessions",
    expected: "keep",
    request: {
      exerciseName: "Hack Squat",
      muscleGroup: "quadriceps",
      weightStepKg: 2.5,
      current: plan(90, [10, 10, 10], 120),
      history: history(
        sets(90, 10, [9, 7, 6]),
        sets(90, 10, [10, 9, 8]),
        sets(90, 10, [10, 9, 8]),
      ),
    },
  },
  {
    name: "Rep target too low for a small isolation lift",
    expected: "lighter-more-reps",
    request: {
      exerciseName: "Dumbbell Curl",
      muscleGroup: "biceps",
      weightStepKg: 2,
      current: plan(20, [5, 5, 5], 90),
      history: history(
        sets(20, 5, [5, 5, 4]),
        sets(20, 5, [5, 4, 4]),
        sets(20, 5, [5, 5, 4]),
      ),
    },
  },
  {
    name: "Rep target too high for a heavy barbell lift",
    expected: "heavier-fewer-reps",
    request: {
      exerciseName: "Barbell Row",
      muscleGroup: "back",
      weightStepKg: 2.5,
      current: plan(40, [20, 20, 20], 120),
      history: history(
        sets(40, 20, [20, 18, 17]),
        sets(40, 20, [20, 19, 17]),
        sets(40, 20, [19, 18, 17]),
      ),
    },
  },
  {
    name: "Low reps that suit a heavy lift, still building",
    expected: "keep",
    request: {
      exerciseName: "Barbell Bench Press",
      muscleGroup: "chest",
      weightStepKg: 2.5,
      current: plan(80, [6, 6, 6], 180),
      history: history(
        sets(80, 6, [6, 5, 5]),
        sets(80, 6, [6, 5, 4]),
        sets(80, 6, [5, 5, 4]),
      ),
    },
  },
  {
    name: "Scheme just changed by the lifter",
    expected: "keep",
    request: {
      exerciseName: "Dumbbell Lateral Raise",
      muscleGroup: "shoulders",
      weightStepKg: 1,
      current: plan(12, [6, 6, 6], 60),
      history: history(
        sets(12, 6, [6, 6, 5]),
        sets(8, 12, [12, 12, 11]),
        sets(8, 12, [12, 11, 11]),
      ),
    },
  },
  {
    name: "Small isolation targets hit, big weight jump",
    expected: "reps-up",
    request: {
      exerciseName: "Dumbbell Lateral Raise",
      muscleGroup: "shoulders",
      weightStepKg: 1,
      current: plan(8, [12, 12, 12], 60),
      history: history(
        sets(8, 12, [12, 12, 12]),
        sets(8, 12, [12, 12, 12]),
        sets(8, 12, [12, 11, 10]),
      ),
    },
  },
  {
    name: "Bodyweight pull-ups, targets hit twice",
    expected: "reps-up",
    request: {
      exerciseName: "Pull-up",
      muscleGroup: "back",
      weightStepKg: 2.5,
      current: plan(0, [10, 10, 10], 120),
      history: history(
        sets(0, 10, [10, 10, 10]),
        sets(0, 10, [10, 10, 10]),
        sets(0, 10, [10, 9, 8]),
      ),
    },
  },
];
