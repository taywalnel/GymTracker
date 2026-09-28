import {
  ExercisePrescription,
  targetRepsFields,
  targetWeightFields,
} from "./workout.models";

/**
 * The contract with the getExerciseFeedback Cloud Function; keep in step with
 * functions/src/feedback.ts. Weights are always kilograms.
 */
export interface FeedbackSet {
  reps: number;
  weightKg: number;
  targetReps?: number;
}

export interface FeedbackSession {
  date: string;
  targetSets?: number;
  sets: FeedbackSet[];
}

/** A prescription with every set spelled out. */
export interface FeedbackPrescription {
  setWeightsKg: number[];
  setReps: number[];
  restSeconds: number;
}

export interface ExerciseFeedbackRequest {
  exerciseName: string;
  /** From the exercise catalog, e.g. "shoulders"; absent when not set. */
  muscleGroup?: string;
  weightStepKg: number;
  current: FeedbackPrescription;
  /** Newest first. */
  history: FeedbackSession[];
  today?: FeedbackSet[];
}

export interface ExerciseFeedback {
  verdict: "keep" | "change";
  summary: string;
  /** Present only when verdict is "change". */
  recommendation?: FeedbackPrescription;
}

/** Sessions sent with each request; the function accepts at most 10. */
export const FEEDBACK_HISTORY_LIMIT = 10;
/** Sessions needed before feedback is offered. */
export const FEEDBACK_MIN_HISTORY = 2;

/** The prescription with a recommendation applied, keeping its id and order. */
export function applyRecommendation<T extends ExercisePrescription>(
  prescription: T,
  recommendation: FeedbackPrescription,
): T {
  const {
    setWeightsKg: _weights,
    setReps: _reps,
    ...rest
  } = prescription;
  return {
    ...rest,
    ...targetWeightFields(recommendation.setWeightsKg),
    ...targetRepsFields(recommendation.setReps),
    targetSets: recommendation.setReps.length,
    restSeconds: recommendation.restSeconds,
  } as T;
}
