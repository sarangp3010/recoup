// Data-packet body-summary parsing. Field names and `kind` tags match the
// identifiers in the fixture `expected` blocks.

import { byteAt, readI16Le, readU16Le } from "../bytes.js";

export interface I16SeriesSummary {
  name: string;
  offset: number;
  expected_count: number;
  parsed_count: number;
  min: number | null;
  max: number | null;
  sum: number;
  preview: number[];
}

export type DataPacketBodySummary =
  | {
      kind: "normal_history";
      hr_present: boolean | null;
      marker_offset: number | null;
      marker_value: number | null;
    }
  | {
      kind: "r17_optical_or_labrador_filtered";
      flags: number | null;
      flag_bit_9: boolean | null;
      flag_bit_11: boolean | null;
      channels_or_gain: number[];
      sample_count: number | null;
      samples: I16SeriesSummary | null;
      warnings: string[];
    }
  | {
      kind: "raw_motion_k10";
      heart_rate: number | null;
      axes: I16SeriesSummary[];
      warnings: string[];
    }
  | {
      kind: "raw_motion_k21";
      field_x: number | null;
      group_1_count: number | null;
      group_2_count: number | null;
      axes: I16SeriesSummary[];
      warnings: string[];
    };

export function dataPacketDomain(packetK: number): string | undefined {
  switch (packetK) {
    case 7:
      return "legacy_raw_or_research_counted";
    case 9:
    case 12:
    case 18:
    case 24:
      return "normal_history_with_hr_marker";
    case 10:
    case 21:
      return "raw_motion_stream_result";
    case 11:
      return "raw_stream_counted";
    case 16:
      return "raw_ecg_labrador";
    case 17:
      return "r17_optical_or_labrador_filtered";
    case 19:
    case 22:
      return "research_packet";
    case 20:
      return "raw_or_research_counted";
    case 25:
    case 26:
      return "pulse_information_packet";
    default:
      return undefined;
  }
}

export function historyHrMarkerOffset(packetK: number): number | undefined {
  switch (packetK) {
    case 7:
      return 27;
    case 9:
    case 12:
    case 24:
      return 17;
    case 18:
      return 14;
    default:
      return undefined;
  }
}

interface BodySummaryResult {
  summary: DataPacketBodySummary | null;
  warnings: string[];
}

export function parseDataPacketBodySummary(
  payload: Uint8Array,
  packetK: number | undefined,
  hrMarkerOffset: number | undefined,
  hrPresentMarker: number | undefined,
): BodySummaryResult {
  if (packetK === undefined) return { summary: null, warnings: [] };

  switch (packetK) {
    case 7:
    case 9:
    case 12:
    case 18:
    case 24:
      return {
        summary: {
          kind: "normal_history",
          hr_present: hrPresentMarker === undefined ? null : hrPresentMarker !== 0,
          marker_offset: hrMarkerOffset ?? null,
          marker_value: hrPresentMarker ?? null,
        },
        warnings: [],
      };
    case 17:
      return parseR17BodySummary(payload);
    case 10:
      return parseK10RawMotionSummary(payload);
    case 21:
      return parseK21RawMotionSummary(payload);
    default:
      return { summary: null, warnings: [] };
  }
}

function parseR17BodySummary(payload: Uint8Array): BodySummaryResult {
  const flags = readU16Le(payload, 13);
  const sampleCount = readU16Le(payload, 24);
  const channelsOrGain: number[] = [];
  for (let offset = 15; offset <= 20; offset++) {
    const value = byteAt(payload, offset);
    if (value !== undefined) channelsOrGain.push(value);
  }
  const { summary: samples, warnings } = summarizeI16Series(
    payload,
    26,
    sampleCount ?? 0,
    "r17_samples",
  );
  if (payload.length < 26) warnings.push("r17_header_too_short");

  return {
    summary: {
      kind: "r17_optical_or_labrador_filtered",
      flags: flags ?? null,
      flag_bit_9: flags === undefined ? null : (flags & (1 << 9)) !== 0,
      flag_bit_11: flags === undefined ? null : (flags & (1 << 11)) !== 0,
      channels_or_gain: channelsOrGain,
      sample_count: sampleCount ?? null,
      samples,
      warnings: [...warnings],
    },
    warnings,
  };
}

function parseK10RawMotionSummary(payload: Uint8Array): BodySummaryResult {
  const axes: I16SeriesSummary[] = [];
  const warnings: string[] = [];
  const specs: [string, number][] = [
    ["accelerometer_x", 85],
    ["accelerometer_y", 285],
    ["accelerometer_z", 485],
    ["gyroscope_x", 688],
    ["gyroscope_y", 888],
    ["gyroscope_z", 1088],
  ];
  for (const [name, offset] of specs) {
    const { summary, warnings: axisWarnings } = summarizeI16Series(payload, offset, 100, name);
    warnings.push(...axisWarnings);
    if (summary) axes.push(summary);
  }

  return {
    summary: {
      kind: "raw_motion_k10",
      heart_rate: byteAt(payload, 17) ?? null,
      axes,
      warnings: [...warnings],
    },
    warnings,
  };
}

function parseK21RawMotionSummary(payload: Uint8Array): BodySummaryResult {
  const group1Count = readU16Le(payload, 16);
  const group2Count = readU16Le(payload, 622);
  const axes: I16SeriesSummary[] = [];
  const warnings: string[] = [];
  const specs: [string, number, number | undefined][] = [
    ["group_1_axis_0", 20, group1Count],
    ["group_1_axis_1", 220, group1Count],
    ["group_1_axis_2", 420, group1Count],
    ["group_2_axis_0", 632, group2Count],
    ["group_2_axis_1", 832, group2Count],
    ["group_2_axis_2", 1032, group2Count],
  ];
  for (const [name, offset, count] of specs) {
    const { summary, warnings: axisWarnings } = summarizeI16Series(
      payload,
      offset,
      count ?? 0,
      name,
    );
    warnings.push(...axisWarnings);
    if (summary) axes.push(summary);
  }

  return {
    summary: {
      kind: "raw_motion_k21",
      field_x: readU16Le(payload, 14) ?? null,
      group_1_count: group1Count ?? null,
      group_2_count: group2Count ?? null,
      axes,
      warnings: [...warnings],
    },
    warnings,
  };
}

function summarizeI16Series(
  payload: Uint8Array,
  offset: number,
  expectedCount: number,
  name: string,
): { summary: I16SeriesSummary | null; warnings: string[] } {
  if (expectedCount === 0) {
    return {
      summary: {
        name,
        offset,
        expected_count: 0,
        parsed_count: 0,
        min: null,
        max: null,
        sum: 0,
        preview: [],
      },
      warnings: [],
    };
  }

  const availableBytes = Math.max(0, payload.length - offset);
  const parsedCount = Math.min(expectedCount, Math.floor(availableBytes / 2));
  const warnings: string[] = [];
  if (parsedCount < expectedCount) warnings.push(`${name}_truncated`);

  let min: number | null = null;
  let max: number | null = null;
  let sum = 0;
  const preview: number[] = [];
  for (let index = 0; index < parsedCount; index++) {
    const value = readI16Le(payload, offset + index * 2)!;
    min = min === null ? value : Math.min(min, value);
    max = max === null ? value : Math.max(max, value);
    sum += value;
    if (preview.length < 8) preview.push(value);
  }

  return {
    summary: {
      name,
      offset,
      expected_count: expectedCount,
      parsed_count: parsedCount,
      min,
      max,
      sum,
      preview,
    },
    warnings,
  };
}
