// Shared scoring primitives. Non-finite
// inputs clamp to 0. The final score of a weighted algorithm is the plain sum
// of component contributions; weights are pre-normalized to sum to 1.0 and
// `outputScale` sets the range (100 for most, 21 for strain).

/** Clamp into [0, max]; non-finite (NaN/Inf) becomes 0. */
export function clampTo(max: number, value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

export const clamp0to100 = (value: number): number => clampTo(100, value);
export const clampFraction = (value: number): number => clampTo(1, value);

/** A weighted contributor to a score. `score_0_to_100` is stored already clamped. */
export interface ScoreComponent {
  name: string;
  value: number;
  unit: string;
  score_0_to_100: number;
  weight: number;
  contribution: number;
}

/** A raw (unweighted) reported statistic, e.g. HRV's mean_nn/rmssd. */
export interface MetricComponent {
  name: string;
  value: number;
  unit: string;
}

export function scoreComponent(
  name: string,
  value: number,
  unit: string,
  score_0_to_100: number,
  weight: number,
  outputScale: number,
): ScoreComponent {
  const clamped = clamp0to100(score_0_to_100);
  return {
    name,
    value,
    unit,
    score_0_to_100: clamped,
    weight,
    contribution: (clamped / 100) * outputScale * weight,
  };
}

/** The overall score: the plain sum of every component's contribution. */
export function componentSum(components: readonly ScoreComponent[]): number {
  return components.reduce((sum, c) => sum + c.contribution, 0);
}

/**
 * Validation failure carrying the algorithm's error codes. A failed validation
 * throws so callers get the flat output type on success.
 */
export class AlgorithmError extends Error {
  constructor(public readonly codes: string[]) {
    super(codes.join(", "));
    this.name = "AlgorithmError";
  }
}
