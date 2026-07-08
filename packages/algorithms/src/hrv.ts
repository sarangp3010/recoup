// The recoup.hrv.v0 time-domain HRV algorithm.
// Emits raw statistics (no weighting). Valid RR/NN intervals are finite and
// within [300, 2000] ms inclusive.

import { AlgorithmError, type MetricComponent } from "./scoring.js";

export const RECOUP_HRV_V0_ID = "recoup.hrv.v0";
export const RECOUP_HRV_V0_VERSION = "0.1.0";

const RR_MIN_MS = 300;
const RR_MAX_MS = 2000;

export interface HrvInput {
  start_time: string;
  end_time: string;
  rr_intervals_ms: number[];
  input_ids?: string[];
}

export interface HrvOutput {
  algorithm_id: string;
  version: string;
  interval_count: number;
  valid_interval_count: number;
  invalid_interval_count: number;
  mean_nn_ms: number;
  rmssd_ms: number;
  sdnn_ms: number;
  pnn50_fraction: number;
  quality_flags: string[];
  components: MetricComponent[];
}

export function runHrv(input: HrvInput): HrvOutput {
  const intervals = input.rr_intervals_ms;
  const valid: number[] = [];
  let invalidCount = 0;
  for (const interval of intervals) {
    if (Number.isFinite(interval) && interval >= RR_MIN_MS && interval <= RR_MAX_MS) {
      valid.push(interval);
    } else {
      invalidCount += 1;
    }
  }

  const qualityFlags: string[] = [];
  if (invalidCount > 0) qualityFlags.push("invalid_rr_interval_dropped");
  if (valid.length < 30) qualityFlags.push("low_interval_count");

  if (valid.length < 2) {
    throw new AlgorithmError(["not_enough_valid_rr_intervals"]);
  }

  const n = valid.length;
  const meanNn = valid.reduce((sum, v) => sum + v, 0) / n;

  let sumSquaredDiffs = 0;
  let pnn50Count = 0;
  for (let i = 0; i + 1 < n; i++) {
    const diff = valid[i + 1]! - valid[i]!;
    sumSquaredDiffs += diff * diff;
    if (Math.abs(diff) > 50) pnn50Count += 1;
  }
  const rmssd = Math.sqrt(sumSquaredDiffs / (n - 1));

  const variance = valid.reduce((sum, v) => sum + (v - meanNn) * (v - meanNn), 0) / (n - 1);
  const sdnn = Math.sqrt(variance);

  const pnn50 = pnn50Count / (n - 1);

  return {
    algorithm_id: RECOUP_HRV_V0_ID,
    version: RECOUP_HRV_V0_VERSION,
    interval_count: intervals.length,
    valid_interval_count: n,
    invalid_interval_count: invalidCount,
    mean_nn_ms: meanNn,
    rmssd_ms: rmssd,
    sdnn_ms: sdnn,
    pnn50_fraction: pnn50,
    quality_flags: qualityFlags,
    components: [
      { name: "mean_nn", value: meanNn, unit: "ms" },
      { name: "rmssd", value: rmssd, unit: "ms" },
      { name: "sdnn", value: sdnn, unit: "ms" },
      { name: "pnn50", value: pnn50, unit: "fraction" },
    ],
  };
}
