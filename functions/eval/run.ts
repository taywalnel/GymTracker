/**
 * Runs the feedback prompt against the cases in cases.ts and reports which
 * verdicts differ from what's expected. Run it after changing the coaching
 * guide or the prompt, before deploying:
 *
 *   ANTHROPIC_API_KEY=... npm run eval
 *   ANTHROPIC_API_KEY=... npm run eval -- dumbbell   (only matching cases)
 *
 * Each run makes one real request per case (about 1 cent each).
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  ExerciseFeedback,
  ExerciseFeedbackRequest,
  normaliseFeedback,
} from "../src/feedback";
import { feedbackMessageParams, parseFeedbackReply } from "../src/prompt";
import { CASES, EvalCase, Expected } from "./cases";

const CONCURRENCY = 4;

/** Which way a verdict moves the prescription. */
function direction(
  feedback: ExerciseFeedback,
  request: ExerciseFeedbackRequest,
): Expected {
  const change = feedback.recommendation;
  if (feedback.verdict === "keep" || !change) return "keep";
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  const current = request.current;
  const weight = sum(change.setWeightsKg) - sum(current.setWeightsKg);
  const reps = sum(change.setReps) - sum(current.setReps);
  if (weight < -0.01 && reps > 0) return "lighter-more-reps";
  if (weight > 0.01 && reps < 0) return "heavier-fewer-reps";
  if (weight > 0.01) return "weight-up";
  if (reps > 0) return "reps-up";
  if (weight < -0.01 || reps < 0) return "down";
  return "rest";
}

async function runCase(client: Anthropic, evalCase: EvalCase) {
  const response = await client.messages.create(
    feedbackMessageParams(evalCase.request),
  );
  const raw = parseFeedbackReply(response) as ExerciseFeedback;
  const final = normaliseFeedback(raw, evalCase.request);
  return {
    evalCase,
    // The model's own answer, before the app's rounding and backstop.
    modelGot: direction(raw, evalCase.request),
    got: direction(final, evalCase.request),
    summary: final.summary,
    usage: response.usage,
  };
}

async function main(): Promise<void> {
  const client = new Anthropic();
  const results: Awaited<ReturnType<typeof runCase>>[] = [];
  // `npm run eval -- bench` runs only the cases whose name contains "bench".
  const filter = process.argv[2]?.toLowerCase();
  const queue = CASES.filter(
    (evalCase) => !filter || evalCase.name.toLowerCase().includes(filter),
  );
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        results.push(await runCase(client, next));
      }
    }),
  );

  results.sort(
    (left, right) =>
      CASES.indexOf(left.evalCase) - CASES.indexOf(right.evalCase),
  );
  let failures = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const result of results) {
    const passed = result.got === result.evalCase.expected;
    if (!passed) failures++;
    inputTokens += result.usage.input_tokens;
    outputTokens += result.usage.output_tokens;
    const backstop =
      result.modelGot !== result.got ? ` (model said ${result.modelGot})` : "";
    console.log(
      `${passed ? "PASS" : "FAIL"}  ${result.evalCase.name}\n` +
        `      expected ${result.evalCase.expected}, got ${result.got}${backstop}\n` +
        `      "${result.summary}"\n`,
    );
  }

  const costUsd = (inputTokens * 2 + outputTokens * 10) / 1_000_000;
  console.log(
    `${results.length - failures}/${results.length} passed · ` +
      `${inputTokens} input + ${outputTokens} output tokens ≈ $${costUsd.toFixed(3)}`,
  );
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
