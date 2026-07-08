// The recoup.sleep.v0 sleep-score algorithm.
// Only duration/efficiency/consistency/disturbances carry weight; latency, WASO
// and restorative-sleep are diagnostic (weight 0).

import {
  AlgorithmError,
  clamp0to100,
  clampFraction,
  componentSum,
  scoreComponent,
  type ScoreComponent,
} from "./scoring.js";

export const RECOUP_SLEEP_V0_ID = "recoup.sleep.v0";
export const RECOUP_SLEEP_V0_VERSION = "0.1.0";

export interface SleepInput {
  start_time: string;
  end_time: string;
  sleep_duration_minutes: number;
  sleep_need_minutes: number;
  time_in_bed_minutes: number;
  midpoint_deviation_minutes: number;
  disturbance_count: number;
  sleep_latency_minutes?: number;
  wake_after_sleep_onset_minutes?: number;
  wake_episode_count?: number;
  stage_minutes?: Record<string, number>;
  heart_rate_dip_percent?: number | null;
  input_ids?: string[];
}

export interface SleepOutput {
  algorithm_id: string;
  version: string;
  score_0_to_100: number;
  sleep_performance_fraction: number;
  sleep_debt_minutes: number;
  efficiency_fraction: number;
  awake_minutes: number;
  restorative_sleep_minutes: number;
  restorative_sleep_fraction: number;
  sleep_latency_minutes: number;
  wake_after_sleep_onset_minutes: number;
  wake_episode_count: number;
  heart_rate_dip_percent: number | null;
  quality_flags: string[];
  component_count: number;
  components: ScoreComponent[];
}

const isFinitePositive = (v: number): boolean => Number.isFinite(v) && v > 0;
const isFiniteNonNegative = (v: number): boolean => Number.isFinite(v) && v >= 0;

export function runSleep(input: SleepInput): SleepOutput {
  const latency = input.sleep_latency_minutes ?? 0;
  const waso = input.wake_after_sleep_onset_minutes ?? 0;
  const wakeEpisodes = input.wake_episode_count ?? 0;
  const stages = input.stage_minutes ?? {};
  const hrDip = input.heart_rate_dip_percent ?? null;

  const errors: string[] = [];
  if (!isFinitePositive(input.sleep_need_minutes)) errors.push("sleep_need_minutes_must_be_positive");
  if (!isFinitePositive(input.time_in_bed_minutes)) errors.push("time_in_bed_minutes_must_be_positive");
  if (!isFiniteNonNegative(input.sleep_duration_minutes)) errors.push("sleep_duration_minutes_must_be_non_negative");
  if (!isFiniteNonNegative(input.midpoint_deviation_minutes)) errors.push("midpoint_deviation_minutes_must_be_non_negative");
  if (!isFiniteNonNegative(latency)) errors.push("sleep_latency_minutes_must_be_non_negative");
  if (!isFiniteNonNegative(waso)) errors.push("wake_after_sleep_onset_minutes_must_be_non_negative");
  if (hrDip !== null && !isFiniteNonNegative(hrDip)) errors.push("heart_rate_dip_percent_must_be_non_negative");
  for (const value of Object.values(stages)) {
    if (!isFiniteNonNegative(value)) {
      errors.push("stage_minutes_must_be_finite_non_negative");
      break;
    }
  }
  if (errors.length > 0) throw new AlgorithmError(errors);

  const duration = input.sleep_duration_minutes;
  const need = input.sleep_need_minutes;
  const tib = input.time_in_bed_minutes;

  const performanceFraction = clampFraction(duration / need);
  const durationScore = clamp0to100((duration / need) * 100);
  const efficiencyFraction = clampFraction(duration / tib);
  const efficiencyScore = efficiencyFraction * 100;
  const consistencyScore = clamp0to100(100 - (input.midpoint_deviation_minutes / 120) * 100);
  const disturbanceScore = clamp0to100(100 - input.disturbance_count * 5);
  const sleepDebt = Math.max(need - duration, 0);

  const awakeStage = stages["awake"];
  const awakeMinutes =
    awakeStage !== undefined && isFiniteNonNegative(awakeStage)
      ? awakeStage
      : Math.max(tib - duration, 0);
  const restorativeMinutes = (stages["deep"] ?? 0) + (stages["rem"] ?? 0);
  const restorativeFraction = clampFraction(restorativeMinutes / Math.max(duration, 1));

  const latencyScore = clamp0to100(100 - (latency / 60) * 100);
  const wasoScore = clamp0to100(100 - (waso / 90) * 100);
  const restorativeScore = restorativeFraction * 100;

  const components: ScoreComponent[] = [
    scoreComponent("duration", duration, "minutes", durationScore, 0.45, 100),
    scoreComponent("efficiency", efficiencyFraction, "fraction", efficiencyScore, 0.3, 100),
    scoreComponent("consistency", input.midpoint_deviation_minutes, "minutes", consistencyScore, 0.15, 100),
    scoreComponent("disturbances", input.disturbance_count, "count", disturbanceScore, 0.1, 100),
    scoreComponent("sleep_latency", latency, "minutes", latencyScore, 0, 100),
    scoreComponent("wake_after_sleep_onset", waso, "minutes", wasoScore, 0, 100),
    scoreComponent("restorative_sleep", restorativeFraction, "fraction", restorativeScore, 0, 100),
  ];

  const qualityFlags: string[] = [];
  if (duration < 180) qualityFlags.push("short_sleep_window");
  if (duration > tib) qualityFlags.push("duration_exceeds_time_in_bed");
  if (latency >= 45) qualityFlags.push("long_sleep_latency");
  if (waso >= 45) qualityFlags.push("elevated_wake_after_sleep_onset");
  if (wakeEpisodes >= 4) qualityFlags.push("fragmented_sleep");
  if (Object.keys(stages).length === 0) qualityFlags.push("sleep_architecture_unavailable");
  if (hrDip !== null && hrDip < 8) qualityFlags.push("low_sleep_heart_rate_dip");
  if (Object.keys(stages).length > 0) {
    const stageSum = Object.values(stages).reduce((sum, v) => sum + v, 0);
    if (Math.abs(stageSum - tib) > 5) qualityFlags.push("stage_minutes_do_not_match_time_in_bed");
  }

  return {
    algorithm_id: RECOUP_SLEEP_V0_ID,
    version: RECOUP_SLEEP_V0_VERSION,
    score_0_to_100: componentSum(components),
    sleep_performance_fraction: performanceFraction,
    sleep_debt_minutes: sleepDebt,
    efficiency_fraction: efficiencyFraction,
    awake_minutes: awakeMinutes,
    restorative_sleep_minutes: restorativeMinutes,
    restorative_sleep_fraction: restorativeFraction,
    sleep_latency_minutes: latency,
    wake_after_sleep_onset_minutes: waso,
    wake_episode_count: wakeEpisodes,
    heart_rate_dip_percent: hrDip,
    quality_flags: qualityFlags,
    component_count: components.length,
    components,
  };
}
