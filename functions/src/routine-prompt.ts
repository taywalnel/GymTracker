import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MODEL } from "./prompt";
import {
  GenerateRoutineRequest,
  MUSCLE_GROUPS,
  summariseCatalog,
} from "./routine";

const REP_RANGES_HEADING = "## Rep ranges and rest by exercise type";

/**
 * The rep-range table from the coaching guide, so routines and feedback agree
 * on ranges and rest. Fails at startup if the section is renamed.
 */
function repRangesSection(): string {
  const guide = readFileSync(
    join(__dirname, "..", "coaching-guide.md"),
    "utf8",
  );
  const start = guide.indexOf(REP_RANGES_HEADING);
  if (start === -1) {
    throw new Error(`coaching-guide.md has no "${REP_RANGES_HEADING}" section`);
  }
  const end = guide.indexOf("\n## ", start + REP_RANGES_HEADING.length);
  return guide.slice(start, end === -1 ? undefined : end).trim();
}

const SYSTEM_PROMPT = `You design one workout routine for a lifter who trains for muscle growth (hypertrophy). They choose the muscle groups; you choose the exercises and their starting targets.

You get the chosen muscle groups, the weight step on their equipment, and their exercise catalog: each exercise's id, name, muscle group and up to 3 recent sessions, newest first, with sets written as reps×kg. All weights are kilograms.

Choosing exercises:
- Pick 4 to 7 exercises, enough for a 45–60 minute session. Cover every chosen group, giving large groups (chest, back, quadriceps, hamstrings, glutes) more exercises than small ones.
- Prefer exercises from their catalog, especially ones they've done recently. For those, set catalogExerciseId to the exercise's id and copy its name exactly.
- Add a new exercise (catalogExerciseId "") only when the catalog has nothing suitable for a group. Give it a common, specific name, e.g. "Incline Dumbbell Press".
- Put compound lifts first and isolation work last. Use 2–4 sets per exercise.

Setting targets:
- Use the rep range and rest for each exercise's type from the table below. Every set of an exercise has the same weight and reps.
- For an exercise they've done recently, use the weight from their latest session, with reps inside the range. Never go heavier than they've lifted.
- For any other exercise, estimate a conservative weight from related lifts in their history (e.g. an incline dumbbell press from their flat dumbbell press), so the first session ends 2–3 reps short of failure. With nothing related to go on, pick a light weight that's easy to build from. Bodyweight exercises use 0.
- Weights are multiples of the weight step. Dumbbell weights are per hand.

Name the routine in 1–4 words after what it trains, e.g. "Chest & Triceps" or "Pull Day".

<rep_ranges>
${repRangesSection()}
</rep_ranges>`;

// Structured output keeps the reply to this exact shape.
const ROUTINE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    exercises: {
      type: "array",
      items: {
        type: "object",
        properties: {
          catalogExerciseId: { type: "string" },
          name: { type: "string" },
          muscleGroup: { type: "string", enum: [...MUSCLE_GROUPS] },
          setWeightsKg: { type: "array", items: { type: "number" } },
          setReps: { type: "array", items: { type: "integer" } },
          restSeconds: { type: "integer" },
        },
        required: [
          "catalogExerciseId",
          "name",
          "muscleGroup",
          "setWeightsKg",
          "setReps",
          "restSeconds",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["name", "exercises"],
  additionalProperties: false,
};

/** The Messages API request for a routine request. */
export function routineMessageParams(
  data: GenerateRoutineRequest,
): Anthropic.MessageCreateParamsNonStreaming {
  return {
    model: MODEL,
    // Room for adaptive thinking as well as the reply.
    max_tokens: 16000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: ROUTINE_SCHEMA },
    },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          muscleGroups: data.muscleGroups,
          weightStepKg: data.weightStepKg,
          catalog: summariseCatalog(data),
        }),
      },
    ],
  };
}
