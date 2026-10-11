import Anthropic from "@anthropic-ai/sdk";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  ExerciseFeedback,
  ExerciseFeedbackRequest,
  MIN_HISTORY,
  normaliseFeedback,
  requestError,
} from "./feedback";
import { feedbackMessageParams, parseJsonReply } from "./prompt";
import {
  GenerateRoutineRequest,
  GeneratedRoutine,
  normaliseRoutine,
  requestError as routineRequestError,
} from "./routine";
import { routineMessageParams } from "./routine-prompt";

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

/**
 * Daily request limits per feature. Each keeps its own count in aiUsage/{uid};
 * feedback's fields predate this, hence the plain names.
 */
const LIMITS = {
  feedback: {
    limit: 20,
    dateField: "date",
    countField: "count",
    message: "You've reached today's feedback limit. Try again tomorrow.",
  },
  routine: {
    limit: 5,
    dateField: "routineDate",
    countField: "routineCount",
    message: "You've built today's limit of AI routines. Try again tomorrow.",
  },
} as const;

/**
 * Reviews an exercise's targets against the signed-in person's recent history
 * and returns whether to keep them or a change the app can apply directly.
 */
export const getExerciseFeedback = onCall(
  {
    region: "asia-southeast1",
    secrets: [anthropicApiKey],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request): Promise<ExerciseFeedback> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to get feedback.");
    }

    const error = requestError(request.data);
    if (error) {
      logger.warn("Rejected feedback request", { error, data: request.data });
      throw new HttpsError("invalid-argument", error);
    }
    const data = request.data as ExerciseFeedbackRequest;

    if (data.history.length < MIN_HISTORY) {
      throw new HttpsError(
        "failed-precondition",
        `Log this exercise at least ${MIN_HISTORY} times to get feedback.`,
      );
    }

    await countRequest(uid, "feedback");

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(feedbackMessageParams(data));
    } catch (e) {
      logger.error("Claude request failed", e);
      throw new HttpsError("unavailable", "Feedback isn't available right now.");
    }

    let output: unknown;
    try {
      output = parseJsonReply(response);
    } catch (e) {
      logger.error("Claude returned no usable feedback", e, response);
      throw new HttpsError("internal", "Feedback couldn't be read.");
    }
    logger.info("Feedback usage", response.usage);
    return normaliseFeedback(output, data);
  },
);

/**
 * Builds a routine for the chosen muscle groups from the signed-in person's
 * exercise catalog and recent sessions. The app shows it as a draft to review
 * before anything is saved.
 */
export const generateRoutine = onCall(
  {
    region: "asia-southeast1",
    secrets: [anthropicApiKey],
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async (request): Promise<GeneratedRoutine> => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to build a routine.");
    }

    const error = routineRequestError(request.data);
    if (error) {
      logger.warn("Rejected routine request", { error });
      throw new HttpsError("invalid-argument", error);
    }
    const data = request.data as GenerateRoutineRequest;

    await countRequest(uid, "routine");

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });
    let response: Anthropic.Message;
    try {
      response = await client.messages.create(routineMessageParams(data));
    } catch (e) {
      logger.error("Claude request failed", e);
      throw new HttpsError(
        "unavailable",
        "AI routines aren't available right now.",
      );
    }

    logger.info("Routine usage", response.usage);
    try {
      return normaliseRoutine(parseJsonReply(response), data);
    } catch (e) {
      logger.error("Claude returned no usable routine", e, response);
      throw new HttpsError("internal", "The routine couldn't be read.");
    }
  },
);

/**
 * Counts a request against the person's daily limit for a feature. Kept
 * outside users/ so security rules stop the app from resetting it.
 */
async function countRequest(
  uid: string,
  feature: keyof typeof LIMITS,
): Promise<void> {
  const { limit, dateField, countField, message } = LIMITS[feature];
  const today = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().doc(`aiUsage/${uid}`);
  await getFirestore().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const usage = snap.data() as Record<string, unknown> | undefined;
    const count =
      usage?.[dateField] === today ? Number(usage[countField]) || 0 : 0;
    if (count >= limit) {
      throw new HttpsError("resource-exhausted", message);
    }
    // Merged so each feature's count leaves the others alone.
    transaction.set(
      ref,
      { [dateField]: today, [countField]: count + 1 },
      { merge: true },
    );
  });
}
