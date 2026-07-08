// The recoup.recovery.v0 recovery-score algorithm.
// Six weighted components (HRV, RHR, respiratory, temperature, sleep, prior strain).

import {
  AlgorithmError,
  clamp0to100,
  componentSum,
  scoreComponent,
  type ScoreComponent,
} from "./scoring.js";

export const RECOUP_RECOVERY_V0_ID = "recoup.recovery.v0";
export const RECOUP_RECOVERY_V0_VERSION = "0.1.0";

export interface RecoveryInput {
  start_time: string;
  end_time: string;
  hrv_rmssd_ms: number;
  hrv_baseline_rmssd_ms: number;
  resting_hr_bpm: number;
  resting_hr_baseline_bpm: number;
  respiratory_rate_rpm: number;
  respiratory_rate_baseline_rpm: number;
  skin_temp_delta_c: number;
  sleep_score_0_to_100: number;
  prior_strain_0_to_21: number;
  input_ids?: string[];
}

export interface RecoveryOutput {
  algorithm_id: string;
  version: string;
  score_0_to_100: number;
  quality_flags: string[];
  component_count: number;
  components: ScoreComponent[];
}

const isFinitePositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const inRange = (v: number, lo: number, hi: number): boolean => Number.isFinite(v) && v >= lo && v <= hi;

export function runRecovery(input: RecoveryInput): RecoveryOutput {
  const errors: string[] = [];
  if (!isFinitePositive(input.hrv_baseline_rmssd_ms)) errors.push("hrv_baseline_rmssd_ms_must_be_positive");
  if (!isFinitePositive(input.resting_hr_baseline_bpm)) errors.push("resting_hr_baseline_bpm_must_be_positive");
  if (!isFinitePositive(input.respiratory_rate_baseline_rpm)) errors.push("respiratory_rate_baseline_rpm_must_be_positive");
  if (!isFinitePositive(input.resting_hr_bpm)) errors.push("resting_hr_bpm_must_be_positive");
  if (!isFinitePositive(input.respiratory_rate_rpm)) errors.push("respiratory_rate_rpm_must_be_positive");
  if (!(Number.isFinite(input.hrv_rmssd_ms) && input.hrv_rmssd_ms >= 0)) errors.push("hrv_rmssd_ms_must_be_non_negative");
  if (!inRange(input.sleep_score_0_to_100, 0, 100)) errors.push("sleep_score_out_of_range");
  if (!inRange(input.prior_strain_0_to_21, 0, 21)) errors.push("prior_strain_out_of_range");
  if (errors.length > 0) throw new AlgorithmError(errors);

  const hrvScore = clamp0to100(70 + (input.hrv_rmssd_ms / input.hrv_baseline_rmssd_ms - 1) * 100);
  const rhrScore = clamp0to100(70 + (input.resting_hr_baseline_bpm - input.resting_hr_bpm) * 5);
  const respiratoryScore = clamp0to100(
    100 - Math.abs(input.respiratory_rate_rpm - input.respiratory_rate_baseline_rpm) * 20,
  );
  const temperatureScore = clamp0to100(100 - Math.abs(input.skin_temp_delta_c) * 50);
  const sleepScore = input.sleep_score_0_to_100;
  const strainReadinessScore = clamp0to100(100 - (input.prior_strain_0_to_21 / 21) * 60);

  const components: ScoreComponent[] = [
    scoreComponent("hrv", input.hrv_rmssd_ms, "ms_rmssd", hrvScore, 0.35, 100),
    scoreComponent("rhr", input.resting_hr_bpm, "bpm", rhrScore, 0.2, 100),
    scoreComponent("respiratory", input.respiratory_rate_rpm, "breaths_per_minute", respiratoryScore, 0.1, 100),
    scoreComponent("temperature", input.skin_temp_delta_c, "celsius_delta", temperatureScore, 0.1, 100),
    scoreComponent("sleep", input.sleep_score_0_to_100, "score_0_to_100", sleepScore, 0.15, 100),
    scoreComponent("prior_strain", input.prior_strain_0_to_21, "score_0_to_21", strainReadinessScore, 0.1, 100),
  ];

  const qualityFlags: string[] = [];
  if (input.sleep_score_0_to_100 < 60) qualityFlags.push("low_sleep_score");
  if (input.prior_strain_0_to_21 > 14) qualityFlags.push("high_prior_strain");

  return {
    algorithm_id: RECOUP_RECOVERY_V0_ID,
    version: RECOUP_RECOVERY_V0_VERSION,
    score_0_to_100: componentSum(components),
    quality_flags: qualityFlags,
    component_count: components.length,
    components,
  };
}
