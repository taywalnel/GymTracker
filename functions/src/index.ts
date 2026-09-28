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
import { feedbackMessageParams, parseFeedbackReply } from "./prompt";

initializeApp();

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const DAILY_LIMIT = 20;

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

    await countRequest(uid);

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
      output = parseFeedbackReply(response);
    } catch (e) {
      logger.error("Claude returned no usable feedback", e, response);
      throw new HttpsError("internal", "Feedback couldn't be read.");
    }
    logger.info("Feedback usage", response.usage);
    return normaliseFeedback(output, data);
  },
);

/**
 * Counts a request against the person's daily limit. Kept outside users/ so
 * security rules stop the app from resetting it.
 */
async function countRequest(uid: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = getFirestore().doc(`aiUsage/${uid}`);
  await getFirestore().runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const usage = snap.data() as { date?: string; count?: number } | undefined;
    const count = usage?.date === today ? (usage.count ?? 0) : 0;
    if (count >= DAILY_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        "You've reached today's feedback limit. Try again tomorrow.",
      );
    }
    transaction.set(ref, { date: today, count: count + 1 });
  });
}
