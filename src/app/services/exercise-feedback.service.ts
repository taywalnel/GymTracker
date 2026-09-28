import { Injectable } from "@angular/core";
import { Auth } from "@angular/fire/auth";
import {
  Firestore,
  doc,
  getDoc,
  getDocFromCache,
  setDoc,
} from "@angular/fire/firestore";
import { Functions, httpsCallable } from "@angular/fire/functions";
import { firstValueFrom } from "rxjs";
import {
  ExerciseFeedback,
  ExerciseFeedbackRequest,
  FEEDBACK_HISTORY_LIMIT,
} from "../models/exercise-feedback.models";
import {
  CompletedSet,
  ExerciseLog,
  ExercisePrescription,
  setTargetReps,
  targetRepsPerSet,
  targetWeightsKg,
} from "../models/workout.models";
import { queueWrite } from "../utils/firestore-writes";
import { UnitPreferenceService } from "./unit-preference.service";
import { WorkoutService } from "./workout.service";

/**
 * The last answer for an exercise, stored at users/{uid}/exerciseFeedback/{exerciseId}.
 * `requestKey` is the exact request it answered, so it's only reused while
 * nothing it was based on has changed.
 */
interface SavedFeedback {
  requestKey: string;
  feedback: ExerciseFeedback;
  savedAt: string;
}

/** Thrown when a new answer is needed but there's no connection. */
export class FeedbackOfflineError extends Error {
  constructor() {
    super("Feedback needs a connection.");
  }
}

/** AI feedback on an exercise's targets, from the getExerciseFeedback function. */
@Injectable({ providedIn: "root" })
export class ExerciseFeedbackService {
  // Answers already looked up or fetched, keyed by user and request, so a
  // repeat tap doesn't even read Firestore.
  private readonly answers = new Map<string, ExerciseFeedback>();

  constructor(
    private functions: Functions,
    private firestore: Firestore,
    private auth: Auth,
    private units: UnitPreferenceService,
    private workouts: WorkoutService,
  ) {}

  /**
   * Returns the saved answer when the targets, history and today's sets are
   * unchanged since it was given; otherwise asks for a new one.
   *
   * @param history past logs for the exercise, newest first
   * @param todaySets sets already completed in today's workout
   */
  async getFeedback(
    exerciseId: string,
    name: string,
    prescription: ExercisePrescription,
    history: readonly { date: string; log: ExerciseLog }[],
    todaySets: readonly CompletedSet[] = [],
  ): Promise<ExerciseFeedback> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error("User not authenticated");

    const muscleGroup = await this.muscleGroupOf(exerciseId);
    const request: ExerciseFeedbackRequest = {
      exerciseName: name,
      ...(muscleGroup ? { muscleGroup } : {}),
      weightStepKg: this.units.toKg(this.units.weightStep),
      current: {
        setWeightsKg: targetWeightsKg(prescription),
        setReps: targetRepsPerSet(prescription),
        restSeconds: prescription.restSeconds ?? 60,
      },
      history: history
        .filter(({ log }) => log.completedSets.length > 0)
        .slice(0, FEEDBACK_HISTORY_LIMIT)
        .map(({ date, log }) => ({
          date,
          ...(log.targetSets != null ? { targetSets: log.targetSets } : {}),
          sets: log.completedSets.map((set) =>
            toFeedbackSet(set, setTargetReps(log, set)),
          ),
        })),
      ...(todaySets.length > 0
        ? { today: todaySets.map((set) => toFeedbackSet(set, set.targetReps)) }
        : {}),
    };
    const requestKey = JSON.stringify(request);
    const memoryKey = `${uid}:${requestKey}`;

    const remembered = this.answers.get(memoryKey);
    if (remembered) return remembered;

    const savedRef = doc(
      this.firestore,
      `users/${uid}/exerciseFeedback/${exerciseId}`,
    );
    const saved = await this.readSaved(savedRef, requestKey);
    if (saved) {
      this.answers.set(memoryKey, saved);
      return saved;
    }

    if (!navigator.onLine) throw new FeedbackOfflineError();

    const call = httpsCallable<ExerciseFeedbackRequest, ExerciseFeedback>(
      this.functions,
      "getExerciseFeedback",
    );
    // Round-tripped through JSON so no undefined values reach Firestore.
    const feedback = JSON.parse(
      JSON.stringify((await call(request)).data),
    ) as ExerciseFeedback;
    this.answers.set(memoryKey, feedback);
    const record: SavedFeedback = {
      requestKey,
      feedback,
      savedAt: new Date().toISOString(),
    };
    queueWrite(setDoc(savedRef, record));
    return feedback;
  }

  /** The catalog muscle group, which helps tell what kind of lift it is. */
  private async muscleGroupOf(exerciseId: string): Promise<string | undefined> {
    try {
      const exercises = await firstValueFrom(this.workouts.getAllExercises());
      return exercises.find((exercise) => exercise.id === exerciseId)
        ?.primaryMuscleGroup;
    } catch (e) {
      return undefined;
    }
  }

  /**
   * The saved answer to this exact request, if there is one. Checks the
   * device's copy first, which is instant and works offline, then the server
   * in case it was saved on another device.
   */
  private async readSaved(
    ref: ReturnType<typeof doc>,
    requestKey: string,
  ): Promise<ExerciseFeedback | null> {
    const matching = (data: unknown) => {
      const saved = data as SavedFeedback | undefined;
      return saved?.requestKey === requestKey ? saved.feedback : null;
    };
    try {
      const cached = matching((await getDocFromCache(ref)).data());
      if (cached) return cached;
    } catch (e) {
      // not cached on this device
    }
    if (!navigator.onLine) return null;
    try {
      return matching((await getDoc(ref)).data());
    } catch (e) {
      return null;
    }
  }
}

function toFeedbackSet(set: CompletedSet, targetReps: number | undefined) {
  return {
    reps: set.reps,
    weightKg: set.weightKg,
    ...(targetReps != null ? { targetReps } : {}),
  };
}
