import { applyRecommendation } from "./exercise-feedback.models";
import { ExercisePrescription } from "./workout.models";

describe("applyRecommendation", () => {
  const prescription: ExercisePrescription = {
    id: "bench",
    targetWeightKg: 60,
    setWeightsKg: [60, 55, 50],
    targetReps: 8,
    setReps: [8, 10, 12],
    targetSets: 3,
    restSeconds: 90,
    order: 2,
  };

  it("drops the per-set fields when every set becomes the same", () => {
    expect(
      applyRecommendation(prescription, {
        setWeightsKg: [62.5, 62.5],
        setReps: [8, 8],
        restSeconds: 120,
      }),
    ).toEqual({
      id: "bench",
      targetWeightKg: 62.5,
      targetReps: 8,
      targetSets: 2,
      restSeconds: 120,
      order: 2,
    });
  });

  it("keeps per-set fields when sets differ", () => {
    const { setWeightsKg: _weights, setReps: _reps, ...plain } = prescription;
    const plainPrescription: ExercisePrescription = plain;
    expect(
      applyRecommendation(
        plainPrescription,
        {
          setWeightsKg: [60, 60, 57.5],
          setReps: [8, 8, 10],
          restSeconds: 90,
        },
      ),
    ).toEqual({
      id: "bench",
      targetWeightKg: 60,
      setWeightsKg: [60, 60, 57.5],
      targetReps: 8,
      setReps: [8, 8, 10],
      targetSets: 3,
      restSeconds: 90,
      order: 2,
    });
  });
});
