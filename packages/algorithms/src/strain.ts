// The recoup.strain.v0 strain-score algorithm.
// Output range is 0-21. zone_load = Σ zoneMinutes[i] * [1,2,3,4,5][i].

import {
  AlgorithmError,
  clampFraction,
  clampTo,
  componentSum,
  scoreComponent,
  type ScoreComponent,
} from "./scoring.js";

export const RECOUP_STRAIN_V0_ID = "recoup.strain.v0";
export const RECOUP_STRAIN_V0_VERSION = "0.1.0";

const ZONE_WEIGHTS = [1, 2, 3, 4, 5];
const ZONE_LOAD_DIVISOR = 20;
const STRAIN_SCALE = 21;

export interface StrainInput {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  resting_hr_bpm: number;
  average_hr_bpm: number;
  max_hr_bpm: number;
  hr_zone_minutes: number[];
  input_ids?: string[];
}

export interface StrainOutput {
  algorithm_id: string;
  version: string;
  score_0_to_21: number;
  zone_load: number;
  average_hr_reserve_fraction: number;
  quality_flags: string[];
  component_count: number;
  components: ScoreComponent[];
}

const isFinitePositive = (v: number): boolean => Number.isFinite(v) && v > 0;

export function runStrain(input: StrainInput): StrainOutput {
  const errors: string[] = [];
  if (!isFinitePositive(input.duration_minutes)) errors.push("duration_minutes_must_be_positive");
  if (!isFinitePositive(input.resting_hr_bpm)) errors.push("resting_hr_bpm_must_be_positive");
  if (!isFinitePositive(input.average_hr_bpm)) errors.push("average_hr_bpm_must_be_positive");
  if (!isFinitePositive(input.max_hr_bpm)) errors.push("max_hr_bpm_must_be_positive");
  if (input.max_hr_bpm <= input.resting_hr_bpm) errors.push("max_hr_must_exceed_resting_hr");
  if (input.hr_zone_minutes.length !== 5) errors.push("five_hr_zones_required");
  if (input.hr_zone_minutes.some((z) => !(Number.isFinite(z) && z >= 0)))
    errors.push("zone_minutes_must_be_finite_non_negative");
  if (errors.length > 0) throw new AlgorithmError(errors);

  const zoneLoad = input.hr_zone_minutes.reduce(
    (sum, minutes, i) => sum + minutes * ZONE_WEIGHTS[i]!,
    0,
  );
  const zoneScore0to21 = clampTo(STRAIN_SCALE, zoneLoad / ZONE_LOAD_DIVISOR);
  const hrReserveFraction = clampFraction(
    (input.average_hr_bpm - input.resting_hr_bpm) / (input.max_hr_bpm - input.resting_hr_bpm),
  );

  const zoneScore0to100 = (zoneScore0to21 / STRAIN_SCALE) * 100;
  const avgHrScore0to100 = hrReserveFraction * 100;

  const components: ScoreComponent[] = [
    scoreComponent("zone_load", zoneLoad, "weighted_minutes", zoneScore0to100, 0.7, STRAIN_SCALE),
    scoreComponent("average_hr_reserve", hrReserveFraction, "fraction", avgHrScore0to100, 0.3, STRAIN_SCALE),
  ];

  const qualityFlags: string[] = [];
  const zoneSum = input.hr_zone_minutes.reduce((sum, z) => sum + z, 0);
  if (Math.abs(zoneSum - input.duration_minutes) > 5) qualityFlags.push("zone_minutes_duration_mismatch");

  return {
    algorithm_id: RECOUP_STRAIN_V0_ID,
    version: RECOUP_STRAIN_V0_VERSION,
    score_0_to_21: componentSum(components),
    zone_load: zoneLoad,
    average_hr_reserve_fraction: hrReserveFraction,
    quality_flags: qualityFlags,
    component_count: components.length,
    components,
  };
}
