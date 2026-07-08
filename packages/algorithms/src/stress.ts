// The recoup.stress.v0 stress-score algorithm.
// Motion attenuates the HR-elevation component by up to 50%.

import {
  AlgorithmError,
  clamp0to100,
  clampFraction,
  componentSum,
  scoreComponent,
  type ScoreComponent,
} from "./scoring.js";

export const RECOUP_STRESS_V0_ID = "recoup.stress.v0";
export const RECOUP_STRESS_V0_VERSION = "0.1.0";

export interface StressInput {
  start_time: string;
  end_time: string;
  heart_rate_bpm: number;
  resting_hr_bpm: number;
  hrv_rmssd_ms: number;
  hrv_baseline_rmssd_ms: number;
  motion_intensity_0_to_1: number;
  input_ids?: string[];
}

export interface StressOutput {
  algorithm_id: string;
  version: string;
  score_0_to_100: number;
  heart_rate_elevation_score: number;
  hrv_suppression_score: number;
  motion_adjusted_hr_score: number;
  quality_flags: string[];
  component_count: number;
  components: ScoreComponent[];
}

const isFinitePositive = (v: number): boolean => Number.isFinite(v) && v > 0;

export function runStress(input: StressInput): StressOutput {
  const errors: string[] = [];
  if (!isFinitePositive(input.heart_rate_bpm)) errors.push("heart_rate_bpm_must_be_positive");
  if (!isFinitePositive(input.resting_hr_bpm)) errors.push("resting_hr_bpm_must_be_positive");
  if (!isFinitePositive(input.hrv_baseline_rmssd_ms)) errors.push("hrv_baseline_rmssd_ms_must_be_positive");
  if (!(Number.isFinite(input.hrv_rmssd_ms) && input.hrv_rmssd_ms >= 0)) errors.push("hrv_rmssd_ms_must_be_non_negative");
  if (errors.length > 0) throw new AlgorithmError(errors);

  const motion = clampFraction(input.motion_intensity_0_to_1);
  const heartRateElevationScore = clamp0to100(
    (Math.max(input.heart_rate_bpm - input.resting_hr_bpm, 0) / 60) * 100,
  );
  const hrvSuppressionScore = clamp0to100((1 - input.hrv_rmssd_ms / input.hrv_baseline_rmssd_ms) * 100);
  const motionAdjustedHrScore = heartRateElevationScore * (1 - motion * 0.5);

  const components: ScoreComponent[] = [
    scoreComponent("motion_adjusted_hr", motionAdjustedHrScore, "score_0_to_100", motionAdjustedHrScore, 0.6, 100),
    scoreComponent("hrv_suppression", input.hrv_rmssd_ms, "ms_rmssd", hrvSuppressionScore, 0.4, 100),
  ];

  const qualityFlags: string[] = [];
  if (input.heart_rate_bpm < input.resting_hr_bpm) qualityFlags.push("heart_rate_below_resting");
  if (input.motion_intensity_0_to_1 > 0.7) qualityFlags.push("high_motion_context");
  if (input.motion_intensity_0_to_1 < 0 || input.motion_intensity_0_to_1 > 1)
    qualityFlags.push("motion_intensity_clamped");

  return {
    algorithm_id: RECOUP_STRESS_V0_ID,
    version: RECOUP_STRESS_V0_VERSION,
    score_0_to_100: componentSum(components),
    heart_rate_elevation_score: heartRateElevationScore,
    hrv_suppression_score: hrvSuppressionScore,
    motion_adjusted_hr_score: motionAdjustedHrScore,
    quality_flags: qualityFlags,
    component_count: components.length,
    components,
  };
}
