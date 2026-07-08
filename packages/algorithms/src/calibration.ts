// The recovery-calibration evaluator.
// Fits a 1-D ordinary-least-squares model (label = slope*prediction + intercept)
// on train rows and reports holdout error after calibration. The train/holdout
// split is a date cutoff supplied as an option (records with captured_at < split_at
// are train; on/after are holdout), compared as plain string timestamps.

import { AlgorithmError } from "./scoring.js";

export interface CalibrationRecord {
  record_id: string;
  captured_at: string;
  session_id?: string | null;
  metric_family: string;
  algorithm_id: string;
  algorithm_version: string;
  prediction: number;
  label: number;
  label_source: string;
  label_provenance: unknown;
}

export interface CalibrationDataset {
  schema: string;
  records: CalibrationRecord[];
}

export interface CalibrationOptions {
  metric_family: string;
  algorithm_id: string;
  algorithm_version: string;
  split_at: string;
  min_train_rows?: number;
  min_holdout_rows?: number;
}

export interface CalibrationReport {
  algorithm_id: string;
  version: string;
  slope: number;
  intercept: number;
  split_at: string;
  train_count: number;
  holdout_count: number;
  uncalibrated_holdout_mae: number;
  holdout_mae_after: number;
  holdout_correlation: number | null;
  holdout_improved: boolean;
  pass: boolean;
}

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;

function meanAbsoluteError(rows: CalibrationRecord[], predict: (prediction: number) => number): number {
  return mean(rows.map((r) => Math.abs(predict(r.prediction) - r.label)));
}

/** Pearson correlation of (predicted, label) pairs; null if <2 points or zero variance. */
function correlation(rows: CalibrationRecord[], predict: (prediction: number) => number): number | null {
  if (rows.length < 2) return null;
  const xs = rows.map((r) => predict(r.prediction));
  const ys = rows.map((r) => r.label);
  const xMean = mean(xs);
  const yMean = mean(ys);
  let cov = 0;
  let xVar = 0;
  let yVar = 0;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i]! - xMean;
    const dy = ys[i]! - yMean;
    cov += dx * dy;
    xVar += dx * dx;
    yVar += dy * dy;
  }
  if (xVar === 0 || yVar === 0) return null;
  return cov / (Math.sqrt(xVar) * Math.sqrt(yVar));
}

export function runRecoveryCalibration(
  dataset: CalibrationDataset,
  options: CalibrationOptions,
): CalibrationReport {
  const minTrain = options.min_train_rows ?? 2;
  const minHoldout = options.min_holdout_rows ?? 1;

  const scoped = dataset.records.filter(
    (r) =>
      r.metric_family === options.metric_family &&
      r.algorithm_id === options.algorithm_id &&
      r.algorithm_version === options.algorithm_version,
  );
  const train = scoped.filter((r) => r.captured_at < options.split_at);
  const holdout = scoped.filter((r) => r.captured_at >= options.split_at);

  const errors: string[] = [];
  if (train.length < minTrain) errors.push("not_enough_train_rows");
  if (holdout.length < minHoldout) errors.push("not_enough_holdout_rows");
  if (errors.length > 0) throw new AlgorithmError(errors);

  const xMean = mean(train.map((r) => r.prediction));
  const yMean = mean(train.map((r) => r.label));
  let xVar = 0;
  let cov = 0;
  for (const r of train) {
    const dx = r.prediction - xMean;
    xVar += dx * dx;
    cov += dx * (r.label - yMean);
  }
  if (xVar === 0) throw new AlgorithmError(["training_predictions_have_zero_variance"]);

  const slope = cov / xVar;
  const intercept = yMean - slope * xMean;
  const calibrated = (prediction: number): number => slope * prediction + intercept;

  const uncalibratedMae = meanAbsoluteError(holdout, (p) => p);
  const calibratedMae = meanAbsoluteError(holdout, calibrated);
  const holdoutImproved = calibratedMae < uncalibratedMae;

  return {
    algorithm_id: options.algorithm_id,
    version: options.algorithm_version,
    slope,
    intercept,
    split_at: options.split_at,
    train_count: train.length,
    holdout_count: holdout.length,
    uncalibrated_holdout_mae: uncalibratedMae,
    holdout_mae_after: calibratedMae,
    holdout_correlation: correlation(holdout, calibrated),
    holdout_improved: holdoutImproved,
    pass: holdoutImproved || calibratedMae === 0,
  };
}
