/**
 * The contract between the app and the getExerciseFeedback function, and the
 * pure logic around it: checking the request, summarising the history for the
 * model, and making the model's recommendation safe to apply.
 *
 * Weights are always kilograms, matching how the app stores them.
 */

export interface FeedbackSet {
  reps: number;
  weightKg: number;
  /** The planned reps for this set; absent (or null) on older logs. */
  targetReps?: number | null;
}

export interface FeedbackSession {
  date: string;
  targetSets?: number | null;
  sets: FeedbackSet[];
}

export interface FeedbackPrescription {
  setWeightsKg: number[];
  setReps: number[];
  restSeconds: number;
}

export interface ExerciseFeedbackRequest {
  exerciseName: string;
  /** From the exercise catalog, e.g. "shoulders"; absent when not set. */
  muscleGroup?: string | null;
  /** The weight step on the person's equipment, e.g. 2.5 kg or 5 lb in kg. */
  weightStepKg: number;
  current: FeedbackPrescription;
  /** Past sessions with this exercise, newest first. */
  history: FeedbackSession[];
  /** Sets already completed in today's workout, if any. */
  today?: FeedbackSet[] | null;
}

export interface ExerciseFeedback {
  verdict: "keep" | "change";
  summary: string;
  /** Present only when verdict is "change". */
  recommendation?: FeedbackPrescription;
}

export const MAX_HISTORY = 10;
export const MIN_HISTORY = 2;
const MAX_SETS = 10;
const MAX_REPS = 50;
const MIN_REST = 30;
const MAX_REST = 300;
const REST_STEP = 15;
/** How far one piece of feedback may move a set's weight. */
const MAX_WEIGHT_CHANGE = 0.15;
/** Moving the rep target this far, with the weight the other way, is a scheme change. */
const SCHEME_CHANGE_REPS = 3;

// ---- request checks -------------------------------------------------------

const isNumber = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= min &&
  value <= max;

function isSet(value: unknown): value is FeedbackSet {
  const set = value as FeedbackSet;
  return (
    typeof set === "object" &&
    set !== null &&
    isNumber(set.reps, 0, 1000) &&
    isNumber(set.weightKg, 0, 2000) &&
    (set.targetReps == null || isNumber(set.targetReps, 0, 1000))
  );
}

function isPrescription(value: unknown): value is FeedbackPrescription {
  const prescription = value as FeedbackPrescription;
  return (
    typeof prescription === "object" &&
    prescription !== null &&
    Array.isArray(prescription.setWeightsKg) &&
    Array.isArray(prescription.setReps) &&
    prescription.setReps.length >= 1 &&
    prescription.setReps.length <= 20 &&
    prescription.setWeightsKg.length === prescription.setReps.length &&
    prescription.setWeightsKg.every((weight) => isNumber(weight, 0, 2000)) &&
    prescription.setReps.every((reps) => isNumber(reps, 1, 1000)) &&
    isNumber(prescription.restSeconds, 0, 3600)
  );
}

/** Returns an error message when the request isn't usable, otherwise null. */
export function requestError(data: unknown): string | null {
  const request = data as ExerciseFeedbackRequest;
  if (typeof request !== "object" || request === null) return "Missing request.";
  if (
    typeof request.exerciseName !== "string" ||
    !request.exerciseName.trim() ||
    request.exerciseName.length > 100
  ) {
    return "Invalid exercise name.";
  }
  if (
    request.muscleGroup != null &&
    (typeof request.muscleGroup !== "string" || request.muscleGroup.length > 40)
  ) {
    return "Invalid muscle group.";
  }
  if (!isNumber(request.weightStepKg, 0.1, 10)) return "Invalid weight step.";
  if (!isPrescription(request.current)) return "Invalid prescription.";
  if (
    !Array.isArray(request.history) ||
    request.history.length > MAX_HISTORY ||
    !request.history.every(
      (session) =>
        typeof session === "object" &&
        session !== null &&
        typeof session.date === "string" &&
        session.date.length <= 40 &&
        (session.targetSets == null ||
          isNumber(session.targetSets, 0, 100)) &&
        Array.isArray(session.sets) &&
        session.sets.length <= 20 &&
        session.sets.every(isSet),
    )
  ) {
    return "Invalid history.";
  }
  if (
    request.today != null &&
    (!Array.isArray(request.today) ||
      request.today.length > 20 ||
      !request.today.every(isSet))
  ) {
    return "Invalid sets for today.";
  }
  return null;
}

// ---- history summary ------------------------------------------------------

/** A set within this many reps of its target counts as on track. */
export const ON_TRACK_SHORTFALL = 3;

const topWeightKg = (sets: readonly { weightKg: number }[]) =>
  Math.max(0, ...sets.map((set) => set.weightKg));

const sameWeight = (left: number, right: number) => Math.abs(left - right) < 0.01;

const round = (value: number, decimals = 1) =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const total = (values: readonly number[]) =>
  values.reduce((sum, value) => sum + value, 0);

/** "8/7/6", or a single value when every entry matches, e.g. "37.5". */
const compact = (values: readonly (number | null)[]) =>
  values.every((value) => value === values[0])
    ? String(values[0] ?? "?")
    : values.map((value) => value ?? "?").join("/");

/**
 * One session worked out against its targets. A set logged before targets
 * were saved is measured against the current prescription's target for that
 * set instead.
 */
function describeSession(
  session: FeedbackSession,
  current: FeedbackPrescription,
) {
  let targetsAssumed = false;
  const targets = session.sets.map((set, index) => {
    if (set.targetReps != null) return set.targetReps;
    targetsAssumed = true;
    return current.setReps[index] ?? current.setReps[current.setReps.length - 1];
  });
  const reps = session.sets.map((set) => set.reps);
  const shortfalls = reps.map((count, index) =>
    Math.max(0, targets[index] - count),
  );
  return {
    date: session.date,
    weightKg: compact(session.sets.map((set) => set.weightKg)),
    topWeightKg: topWeightKg(session.sets),
    reps: compact(reps),
    targets: compact(targets),
    ...(targetsAssumed ? { targetsAssumedFromCurrentPlan: true } : {}),
    totalReps: total(reps),
    totalTarget: total(targets),
    everySetHit: shortfalls.every((shortfall) => shortfall === 0),
    firstSetShortBy: shortfalls[0] ?? 0,
    mostRepsShortOnASet: Math.max(0, ...shortfalls),
  };
}

type SessionDescription = ReturnType<typeof describeSession>;

/** Rep targets offered in the table of matching weights. */
const REP_TARGETS = [5, 6, 8, 10, 12, 15, 20];
/** Reps assumed left in the tank at the end of a working set. */
const REPS_IN_RESERVE = 2;

/**
 * The weight for `reps` that matches the effort of `weightKg` for `doneReps`,
 * both leaving a couple of reps in reserve. Averages the Epley and Brzycki
 * estimates, which bracket each other at moderate reps; above 15 Brzycki
 * overshoots badly, so Epley is used alone.
 */
function matchingWeightKg(weightKg: number, doneReps: number, reps: number) {
  const done = doneReps + REPS_IN_RESERVE;
  const wanted = reps + REPS_IN_RESERVE;
  const epley = (1 + done / 30) / (1 + wanted / 30);
  if (Math.max(done, wanted) > 15) return weightKg * epley;
  const brzycki = (37 - wanted) / (37 - done);
  return (weightKg * (epley + brzycki)) / 2;
}

/**
 * The latest session's first set at today's weight, the freshest measure of
 * strength; null for bodyweight work or with no such session.
 */
function strengthMeasure(request: ExerciseFeedbackRequest) {
  const currentTop = Math.max(...request.current.setWeightsKg);
  const latest = request.history[0];
  const first = latest?.sets[0];
  if (
    currentTop <= 0 ||
    !first ||
    first.reps < 1 ||
    !sameWeight(topWeightKg(latest.sets), currentTop)
  ) {
    return null;
  }
  return first;
}

/** The weight that matches current strength for `reps`, or null. */
function weightForReps(
  request: ExerciseFeedbackRequest,
  reps: number,
): number | null {
  const measure = strengthMeasure(request);
  if (!measure) return null;
  const step = request.weightStepKg;
  const weight = matchingWeightKg(measure.weightKg, measure.reps, reps);
  return round(Math.max(step, Math.round(weight / step) * step), 3);
}

/**
 * Facts about the history worked out in code, so the model reasons over them
 * rather than doing arithmetic itself. Sessions are newest first.
 */
export function summariseHistory(request: ExerciseFeedbackRequest) {
  const currentTop = Math.max(...request.current.setWeightsKg);
  const sessions = request.history.map((session) =>
    describeSession(session, request.current),
  );

  // The unbroken run of latest sessions done at today's top weight.
  const firstOtherWeight = sessions.findIndex(
    (session) => !sameWeight(session.topWeightKg, currentTop),
  );
  const atCurrentWeight =
    firstOtherWeight === -1 ? sessions : sessions.slice(0, firstOtherWeight);
  const totalsOldestFirst = atCurrentWeight
    .map((session) => session.totalReps)
    .reverse();

  // How many sessions since the total last went up at this weight.
  let sessionsSinceTotalImproved = 0;
  let best = -Infinity;
  totalsOldestFirst.forEach((count, index) => {
    if (index === 0 || count > best) sessionsSinceTotalImproved = 0;
    else sessionsSinceTotalImproved++;
    best = Math.max(best, count);
  });

  // Sessions done against today's rep targets, newest first, stopping at the
  // first with different (or unknown) targets.
  const currentTargets = compact(request.current.setReps);
  const firstOtherTargets = sessions.findIndex(
    (session) =>
      session.targets !== currentTargets ||
      "targetsAssumedFromCurrentPlan" in session,
  );

  const weightsForReps = Object.fromEntries(
    REP_TARGETS.map((reps) => [reps, weightForReps(request, reps)]),
  );

  const latest = sessions[0];
  const latestDate = Date.parse(latest?.date ?? "");
  return {
    currentRepTargets: currentTargets,
    currentTopWeightKg: currentTop,
    isBodyweight: currentTop === 0,
    weightStepPercentOfCurrent:
      currentTop > 0 ? round((request.weightStepKg / currentTop) * 100) : null,
    sessionsWithCurrentRepTargets:
      firstOtherTargets === -1 ? sessions.length : firstOtherTargets,
    weightsMatchingCurrentStrengthForRepTargets:
      weightsForReps[REP_TARGETS[0]] === null ? null : weightsForReps,
    sessionsAtCurrentWeight: atCurrentWeight.length,
    previousTopWeightKg:
      firstOtherWeight === -1 ? null : sessions[firstOtherWeight].topWeightKg,
    totalRepsAtCurrentWeightOldestToNewest: totalsOldestFirst.join(" → "),
    latestIsBestOrEqualBestAtCurrentWeight:
      atCurrentWeight.length > 0 &&
      atCurrentWeight[0].totalReps ===
        Math.max(...atCurrentWeight.map((session) => session.totalReps)),
    sessionsSinceTotalRepsImproved: sessionsSinceTotalImproved,
    latestOnTrack: latest ? isOnTrack(latest) : false,
    daysSinceLatestSession: Number.isNaN(latestDate)
      ? null
      : Math.max(0, Math.floor((Date.now() - latestDate) / 86_400_000)),
    sessions,
  };
}

const isOnTrack = (session: SessionDescription) =>
  session.mostRepsShortOnASet <= ON_TRACK_SHORTFALL;

/**
 * The latest session was at today's weight, every set was within a few reps
 * of target, and it matched or beat every other session at that weight.
 * Easing off is never right from here.
 */
function holdingSteady(request: ExerciseFeedbackRequest): boolean {
  const summary = summariseHistory(request);
  return (
    summary.sessionsAtCurrentWeight > 0 &&
    summary.latestOnTrack &&
    summary.latestIsBestOrEqualBestAtCurrentWeight
  );
}

// ---- making the recommendation safe ---------------------------------------

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const samePrescription = (
  left: FeedbackPrescription,
  right: FeedbackPrescription,
) =>
  left.restSeconds === right.restSeconds &&
  left.setReps.length === right.setReps.length &&
  left.setReps.every((reps, index) => reps === right.setReps[index]) &&
  left.setWeightsKg.every(
    (weight, index) => Math.abs(weight - right.setWeightsKg[index]) < 0.01,
  );

/**
 * Rounds the model's recommendation to real plate steps and keeps it within
 * safe bounds: sets 1–10, reps 1–50, rest 30–300s, and no set's weight moved
 * by more than about 15% (always allowing at least one plate step), or for a
 * rep scheme change, to within a step of the weight matching current strength.
 * Falls back to "keep" when there's nothing usable or nothing actually changes.
 */
export function normaliseFeedback(
  raw: unknown,
  request: ExerciseFeedbackRequest,
): ExerciseFeedback {
  const feedback = raw as Partial<ExerciseFeedback>;
  const summary =
    typeof feedback?.summary === "string" && feedback.summary.trim()
      ? feedback.summary.trim().slice(0, 400)
      : "Your current targets look right for now.";
  const keep: ExerciseFeedback = {
    verdict: "keep",
    summary,
  };

  const proposed = feedback?.recommendation;
  if (
    feedback?.verdict !== "change" ||
    !proposed ||
    !Array.isArray(proposed.setReps) ||
    !Array.isArray(proposed.setWeightsKg) ||
    proposed.setReps.length < 1
  ) {
    return keep;
  }

  const current = request.current;
  const step = request.weightStepKg;
  const setCount = clamp(proposed.setReps.length, 1, MAX_SETS);
  const setReps = Array.from({ length: setCount }, (_, index) =>
    clamp(Math.round(Number(proposed.setReps[index]) || 0), 1, MAX_REPS),
  );
  const average = (values: readonly number[]) =>
    total(values) / values.length;
  const proposedWeights = proposed.setWeightsKg.map(Number);
  // A rep scheme change moves the reps a long way and the weight the other
  // way, e.g. 3 × 6 to 3 × 12 with less weight.
  const repsMove = average(setReps) - average(current.setReps);
  const weightMove = average(proposedWeights) - average(current.setWeightsKg);
  const schemeChange =
    Math.abs(repsMove) >= SCHEME_CHANGE_REPS && repsMove * weightMove < 0;

  const setWeightsKg = Array.from({ length: setCount }, (_, index) => {
    const currentWeight =
      current.setWeightsKg[index] ??
      current.setWeightsKg[current.setWeightsKg.length - 1];
    const wanted =
      proposedWeights[index] ?? proposedWeights[proposedWeights.length - 1];
    // A scheme change may move the weight further, but only to within a step
    // of the weight that matches current strength for the new reps.
    const matching = schemeChange
      ? weightForReps(request, setReps[index])
      : null;
    const [low, high] =
      matching !== null
        ? [matching - step, matching + step]
        : [
            currentWeight - Math.max(currentWeight * MAX_WEIGHT_CHANGE, step),
            currentWeight + Math.max(currentWeight * MAX_WEIGHT_CHANGE, step),
          ];
    const bounded = clamp(
      Number.isFinite(wanted) ? wanted : currentWeight,
      low,
      high,
    );
    // Round to the equipment's plate step, unless it's already the current
    // weight (which may not sit on a step, e.g. 45.4 kg for 100 lb).
    const stepped =
      Math.abs(bounded - currentWeight) < 0.01
        ? currentWeight
        : Math.round(bounded / step) * step;
    return round(Math.max(0, stepped), 3);
  });
  const wantedRest = Number(proposed.restSeconds) || current.restSeconds;
  const restSeconds =
    wantedRest === current.restSeconds
      ? current.restSeconds
      : clamp(
          Math.round(wantedRest / REST_STEP) * REST_STEP,
          MIN_REST,
          MAX_REST,
        );

  const recommendation = { setWeightsKg, setReps, restSeconds };
  if (samePrescription(recommendation, current)) return keep;

  // A backstop to the coaching guide: never ease off while holding steady.
  // Lighter weight for more reps (or fewer reps with more weight) is a scheme
  // change, not easing off.
  const lighter = setWeightsKg.some(
    (weight, index) => weight < (current.setWeightsKg[index] ?? 0) - 0.01,
  );
  const heavier = setWeightsKg.some(
    (weight, index) => weight > (current.setWeightsKg[index] ?? 0) + 0.01,
  );
  const moreReps = total(setReps) > total(current.setReps);
  const fewerReps = total(setReps) < total(current.setReps);
  const easesOff = (lighter && !moreReps) || (fewerReps && !heavier);
  if (easesOff && holdingSteady(request)) {
    return {
      verdict: "keep",
      summary:
        "You're within a few reps of every target and matching your best at this weight, so keep going.",
    };
  }
  return { ...keep, verdict: "change", recommendation };
}
