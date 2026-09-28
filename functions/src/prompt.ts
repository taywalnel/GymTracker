import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ExerciseFeedbackRequest, summariseHistory } from "./feedback";

export const MODEL = "claude-sonnet-5";

// Deployed alongside the function (functions/coaching-guide.md); read once
// when an instance starts. Resolves the same from src/ and lib/.
const COACHING_GUIDE = readFileSync(
  join(__dirname, "..", "coaching-guide.md"),
  "utf8",
);

const SYSTEM_PROMPT = `You are a strength coach reviewing one exercise in a lifter's routine. Follow the coaching guide below.

You get the exercise's name and muscle group (when known), its current prescription (weight and reps for each set, and rest between sets), a summary of their recent sessions worked out in code (newest first), and any sets already done today. All weights are kilograms, and weights move in steps of weightStepKg.

Reply with a verdict of "keep" or "change", the summary sentence, and the recommendation. The recommendation lists every set: setWeightsKg and setReps each have one entry per set, in order. When the verdict is "keep", repeat the current prescription as the recommendation.

<coaching_guide>
${COACHING_GUIDE}
</coaching_guide>`;

// Structured output keeps the reply to this exact shape. Every field is
// required, so a "keep" verdict repeats the current prescription.
const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["keep", "change"] },
    summary: { type: "string" },
    recommendation: {
      type: "object",
      properties: {
        setWeightsKg: { type: "array", items: { type: "number" } },
        setReps: { type: "array", items: { type: "integer" } },
        restSeconds: { type: "integer" },
      },
      required: ["setWeightsKg", "setReps", "restSeconds"],
      additionalProperties: false,
    },
  },
  required: ["verdict", "summary", "recommendation"],
  additionalProperties: false,
};

/** The Messages API request for a feedback request. */
export function feedbackMessageParams(
  data: ExerciseFeedbackRequest,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    // Room for adaptive thinking as well as the reply.
    max_tokens: 8000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: FEEDBACK_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          exerciseName: data.exerciseName,
          muscleGroup: data.muscleGroup ?? null,
          weightStepKg: data.weightStepKg,
          currentPrescription: data.current,
          history: summariseHistory(data),
          setsDoneToday: data.today ?? [],
        }),
      },
    ],
  };
}

/** The model's JSON reply; throws when it stopped early or sent no text. */
export function parseFeedbackReply(response: Anthropic.Message): unknown {
  const text = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  );
  if (response.stop_reason !== "end_turn" || !text) {
    throw new Error(`Stopped with ${response.stop_reason}`);
  }
  return JSON.parse(text.text);
}
