// Fixture-driven parity tests for the scoring engines. The fixture corpus and
// its `expected` blocks live in @recoup/protocol (fixtures/index.json is the
// single source of truth for the whole repo); we read the algorithm-input
// schemas from there and assert each engine's output against the expected
// subset, mirroring the protocol package's approach.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  runHrv,
  runSleep,
  runStrain,
  runRecovery,
  runStress,
  runRecoveryCalibration,
  runHealthSyncDryRun,
  type CalibrationDataset,
  type HealthSyncDryRunInput,
} from "../src/index.js";

const fixturesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "protocol",
  "fixtures",
);

interface IndexEntry {
  id: string;
  path: string;
  schema: string;
  expected: Record<string, unknown>;
}

const index = JSON.parse(readFileSync(join(fixturesRoot, "index.json"), "utf8")) as {
  fixtures: IndexEntry[];
};

const RUNNERS: Record<string, (input: never) => unknown> = {
  "recoup.hrv-input.v1": runHrv as (input: never) => unknown,
  "recoup.sleep-input.v1": runSleep as (input: never) => unknown,
  "recoup.strain-input.v1": runStrain as (input: never) => unknown,
  "recoup.recovery-input.v1": runRecovery as (input: never) => unknown,
  "recoup.stress-input.v1": runStress as (input: never) => unknown,
};

/** Assert every key present in `expected` matches `actual` (partial/subset). */
function expectSubset(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} should be an array`).toBe(true);
    const arr = actual as unknown[];
    expect(arr.length, `${path} length`).toBe(expected.length);
    expected.forEach((item, i) => expectSubset(arr[i], item, `${path}[${i}]`));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    expect(actual !== null && typeof actual === "object", `${path} should be an object`).toBe(true);
    const obj = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected)) {
      expectSubset(obj[key], value, `${path}.${key}`);
    }
    return;
  }
  // Numbers compare within a relative epsilon: fixtures are recorded at f64
  // double precision and IEEE-754 accumulation order can differ in the last
  // ULP (e.g. sqrt(200), 4.9 + 3.15). Strings/bools stay strict.
  if (typeof expected === "number") {
    expect(typeof actual, `${path} should be a number`).toBe("number");
    const a = actual as number;
    if (Number.isNaN(expected)) {
      expect(Number.isNaN(a), `${path} should be NaN`).toBe(true);
      return;
    }
    const tolerance = 1e-9 * Math.max(1, Math.abs(expected), Math.abs(a));
    expect(Math.abs(a - expected), `${path} ≈ ${expected} (got ${a})`).toBeLessThanOrEqual(tolerance);
    return;
  }
  expect(actual, path).toStrictEqual(expected);
}

describe("scoring engines reproduce their fixtures", () => {
  const scoringFixtures = index.fixtures.filter((f) => f.schema in RUNNERS);

  for (const entry of scoringFixtures) {
    it(entry.id, () => {
      const input = JSON.parse(readFileSync(join(fixturesRoot, entry.path), "utf8"));
      const output = RUNNERS[entry.schema]!(input as never);
      expectSubset(output, entry.expected, entry.id);
    });
  }

  it("covers all five scoring schemas", () => {
    const schemas = new Set(scoringFixtures.map((f) => f.schema));
    expect(schemas).toEqual(new Set(Object.keys(RUNNERS)));
  });
});

describe("recovery calibration reproduces its fixture", () => {
  const entry = index.fixtures.find((f) => f.schema === "recoup.calibration-dataset.v1")!;

  it(entry.id, () => {
    const dataset = JSON.parse(
      readFileSync(join(fixturesRoot, entry.path), "utf8"),
    ) as CalibrationDataset;
    // The split cutoff and scope are evaluator options, not part of the dataset
    // file; they follow the fixture's documented intent (train before 2026-05-04).
    const report = runRecoveryCalibration(dataset, {
      metric_family: "recovery",
      algorithm_id: "recoup.recovery.v0",
      algorithm_version: "0.1.0",
      split_at: "2026-05-04T00:00:00Z",
    });
    expectSubset(report, entry.expected, entry.id);
  });
});

describe("health-sync dry run reproduces its fixture", () => {
  const entry = index.fixtures.find((f) => f.schema === "recoup.health-sync-dry-run.v1")!;

  it(entry.id, () => {
    const input = JSON.parse(
      readFileSync(join(fixturesRoot, entry.path), "utf8"),
    ) as HealthSyncDryRunInput;
    const report = runHealthSyncDryRun(input);
    expectSubset(report, entry.expected, entry.id);
  });
});
