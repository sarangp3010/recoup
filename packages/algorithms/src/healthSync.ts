// The health-sync dry-run planner. Decides, per candidate metric write,
// whether it can be planned for a health platform or must be blocked (with
// sorted+deduped reasons). Covers the rules exercised by the
// recoup.health-sync-dry-run.v1 fixtures and the HealthKit platform mapping;
// unmodeled provenance markers and delete policies are out of scope.

export type HealthPlatform = "health_kit" | "health_connect";

export interface HealthSyncWindow {
  start: string;
  end: string;
}

export interface HealthSyncCandidate {
  record_id: string;
  metric_family: string;
  semantic: string;
  source_kind: string;
  start_time: string;
  end_time: string;
  value: number;
  unit: string;
  algorithm_id?: string | null;
  algorithm_version?: string | null;
  approved_by_user?: boolean;
  provenance: unknown;
}

export interface HealthSyncDryRunInput {
  schema: string;
  platform: HealthPlatform;
  permission_grants: string[];
  backfill: HealthSyncWindow;
  candidates: HealthSyncCandidate[];
  partial_plan_policy?: string;
}

export interface PlannedHealthWrite {
  source_record_id: string;
  destination_type: string;
  unit: string;
  value: number;
}

export interface BlockedHealthRecord {
  source_record_id: string;
  reasons: string[];
}

export interface HealthSyncDryRunReport {
  platform: HealthPlatform;
  candidate_count: number;
  planned_write_count: number;
  blocked_count: number;
  permission_grants: string[];
  planned_writes: PlannedHealthWrite[];
  blocked_records: BlockedHealthRecord[];
  /** First (alphabetically-sorted) reason per blocked record, in candidate order. */
  blocked_reasons: string[];
  pass: boolean;
}

interface PlatformMapping {
  destination_type: string;
  required_unit: string;
}

// HealthKit has no hrv_rmssd mapping by design.
const HEALTH_KIT_MAPPINGS: Record<string, PlatformMapping> = {
  heart_rate: { destination_type: "heartRate", required_unit: "count/min" },
  resting_heart_rate: { destination_type: "restingHeartRate", required_unit: "count/min" },
  hrv_sdnn: { destination_type: "heartRateVariabilitySDNN", required_unit: "ms" },
  respiratory_rate: { destination_type: "respiratoryRate", required_unit: "count/min" },
  oxygen_saturation: { destination_type: "oxygenSaturation", required_unit: "%" },
  body_temperature: { destination_type: "bodyTemperature", required_unit: "degC" },
  steps: { destination_type: "stepCount", required_unit: "count" },
  active_energy: { destination_type: "activeEnergyBurned", required_unit: "kcal" },
};

const SAFE_SOURCE_KINDS = new Set(["decoded_raw", "local_derived", "user_approved_algorithm"]);

function platformMapping(platform: HealthPlatform, semantic: string): PlatformMapping | undefined {
  // Only HealthKit's table is modeled here; Health Connect mappings are not yet
  // modeled, so its non-guarded semantics fall through to unsupported_mapping.
  if (platform === "health_kit") return HEALTH_KIT_MAPPINGS[semantic];
  return undefined;
}

function parseTimestamp(value: string): number | undefined {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : ms;
}

function isEmptyProvenance(provenance: unknown): boolean {
  if (provenance === null || provenance === undefined) return true;
  if (typeof provenance === "object" && !Array.isArray(provenance)) {
    return Object.keys(provenance as Record<string, unknown>).length === 0;
  }
  return false;
}

function candidateReasons(input: HealthSyncDryRunInput, c: HealthSyncCandidate): string[] {
  const reasons: string[] = [];

  const requiredFields: [string, string][] = [
    ["record_id", c.record_id],
    ["metric_family", c.metric_family],
    ["semantic", c.semantic],
    ["source_kind", c.source_kind],
    ["start_time", c.start_time],
    ["end_time", c.end_time],
    ["unit", c.unit],
  ];
  for (const [field, value] of requiredFields) {
    if (value.trim().length === 0) reasons.push(`${field}_required`);
  }

  if (!Number.isFinite(c.value)) reasons.push("value_not_finite");

  const start = parseTimestamp(c.start_time);
  const end = parseTimestamp(c.end_time);
  if (c.start_time.length > 0 && start === undefined) reasons.push("start_time_invalid_timestamp");
  if (c.end_time.length > 0 && end === undefined) reasons.push("end_time_invalid_timestamp");

  const windowStart = parseTimestamp(input.backfill.start);
  const windowEnd = parseTimestamp(input.backfill.end);
  if (start !== undefined && windowStart !== undefined && windowEnd !== undefined) {
    if (!(start >= windowStart && start < windowEnd)) reasons.push("outside_backfill_window");
  }
  if (start !== undefined && end !== undefined && end <= start) {
    reasons.push("end_time_not_after_start_time");
  }

  if (!(c.approved_by_user ?? false)) reasons.push("not_user_approved");
  if (!SAFE_SOURCE_KINDS.has(c.source_kind)) reasons.push("unsafe_source_kind");
  if (typeof c.algorithm_id === "string" && c.algorithm_id.startsWith("reference.")) {
    reasons.push("benchmark_only_algorithm_not_syncable");
  }

  if (isEmptyProvenance(c.provenance)) {
    reasons.push("missing_provenance");
  } else if (typeof c.provenance !== "object" || Array.isArray(c.provenance)) {
    reasons.push("provenance_must_be_object");
  }

  if (input.platform === "health_kit" && c.semantic === "hrv_rmssd") {
    reasons.push("healthkit_rmssd_must_not_be_written_as_sdnn");
  }
  if (input.platform === "health_connect" && c.semantic === "hrv_sdnn") {
    reasons.push("health_connect_has_no_sdnn_record");
  }

  const mapping = platformMapping(input.platform, c.semantic);
  if (mapping === undefined) {
    reasons.push("unsupported_mapping");
  } else {
    if (c.unit !== mapping.required_unit) {
      reasons.push(`unit_mismatch_expected_${mapping.required_unit.replaceAll("/", "_per_")}`);
    }
    if (!input.permission_grants.includes(mapping.destination_type)) {
      reasons.push("permission_denied");
    }
  }

  return [...new Set(reasons)].sort();
}

export function runHealthSyncDryRun(input: HealthSyncDryRunInput): HealthSyncDryRunReport {
  const plannedWrites: PlannedHealthWrite[] = [];
  const blockedRecords: BlockedHealthRecord[] = [];

  for (const candidate of input.candidates) {
    const reasons = candidateReasons(input, candidate);
    if (reasons.length === 0) {
      const mapping = platformMapping(input.platform, candidate.semantic)!;
      plannedWrites.push({
        source_record_id: candidate.record_id,
        destination_type: mapping.destination_type,
        unit: candidate.unit,
        value: candidate.value,
      });
    } else {
      blockedRecords.push({ source_record_id: candidate.record_id, reasons });
    }
  }

  return {
    platform: input.platform,
    candidate_count: input.candidates.length,
    planned_write_count: plannedWrites.length,
    blocked_count: blockedRecords.length,
    permission_grants: [...new Set(input.permission_grants)].sort(),
    planned_writes: plannedWrites,
    blocked_records: blockedRecords,
    blocked_reasons: blockedRecords.map((r) => r.reasons[0]!),
    pass: true,
  };
}
