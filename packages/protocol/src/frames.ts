// Frame parsing, v5 frame builders, and the packet/payload model. Object keys
// and `kind` tags match the identifiers in the fixture `expected` blocks.

import { byteAt, readU16Le, readU32Le } from "./bytes.js";
import { crc16Modbus, crc32LeBytes, crc8 } from "./crc.js";
import { DeviceType, FRAME_START, headerLen } from "./framing.js";
import { encodeHex, decodeHexWithWhitespace } from "./hex.js";
import {
  DataPacketBodySummary,
  dataPacketDomain,
  historyHrMarkerOffset,
  parseDataPacketBodySummary,
} from "./payloads/dataPacket.js";

export const PACKET_TYPE_COMMAND = 35;
export const PACKET_TYPE_COMMAND_RESPONSE = 36;
export const PACKET_TYPE_PUFFIN_COMMAND = 37;
export const PACKET_TYPE_PUFFIN_COMMAND_RESPONSE = 38;
export const PACKET_TYPE_REALTIME_DATA = 40;
export const PACKET_TYPE_REALTIME_RAW_DATA = 43;
export const PACKET_TYPE_HISTORICAL_DATA = 47;
export const PACKET_TYPE_EVENT = 48;
export const PACKET_TYPE_METADATA = 49;
export const PACKET_TYPE_CONSOLE_LOGS = 50;
export const PACKET_TYPE_REALTIME_IMU_DATA_STREAM = 51;
export const PACKET_TYPE_HISTORICAL_IMU_DATA_STREAM = 52;
export const PACKET_TYPE_RELATIVE_PUFFIN_EVENTS = 53;
export const PACKET_TYPE_PUFFIN_EVENTS_FROM_STRAP = 54;
export const PACKET_TYPE_RELATIVE_BATTERY_PACK_CONSOLE_LOGS = 55;
export const PACKET_TYPE_PUFFIN_METADATA = 56;
export const COMMAND_GET_HELLO = 145;

export type ParsedPayload =
  | {
      kind: "command";
      command: number | null;
      command_name: string | null;
      data_offset: number;
      data_hex: string;
      warnings: string[];
    }
  | {
      kind: "command_response";
      response_to_command: number | null;
      response_to_command_name: string | null;
      origin_sequence: number | null;
      result_code: number | null;
      data_offset: number;
      data_hex: string;
      warnings: string[];
    }
  | {
      kind: "event";
      event_id: number | null;
      event_name: string | null;
      timestamp_seconds: number | null;
      timestamp_subseconds: number | null;
      data_offset: number;
      data_hex: string;
      warnings: string[];
    }
  | {
      kind: "data_packet";
      packet_k: number | null;
      domain: string | null;
      status_or_stream: number | null;
      counter_or_page: number | null;
      timestamp_seconds: number | null;
      timestamp_subseconds: number | null;
      hr_marker_offset: number | null;
      hr_present_marker: number | null;
      body_offset: number;
      body_hex: string;
      body_summary: DataPacketBodySummary | null;
      warnings: string[];
    }
  | {
      kind: "raw";
      data_offset: number;
      data_hex: string;
      warnings: string[];
    };

export interface ParsedFrame {
  device_type: DeviceType;
  raw_len: number;
  header_len: number;
  declared_len: number;
  payload_hex: string;
  payload_crc_hex: string;
  header_crc_valid: boolean;
  payload_crc_valid: boolean;
  packet_type: number | null;
  packet_type_name: string | null;
  sequence: number | null;
  command_or_event: number | null;
  parsed_payload: ParsedPayload | null;
  warnings: string[];
}

export function packetTypeName(packetType: number): string | undefined {
  switch (packetType) {
    case PACKET_TYPE_COMMAND:
      return "COMMAND";
    case PACKET_TYPE_COMMAND_RESPONSE:
      return "COMMAND_RESPONSE";
    case PACKET_TYPE_PUFFIN_COMMAND:
      return "PUFFIN_COMMAND";
    case PACKET_TYPE_PUFFIN_COMMAND_RESPONSE:
      return "PUFFIN_COMMAND_RESPONSE";
    case PACKET_TYPE_REALTIME_DATA:
      return "REALTIME_DATA";
    case PACKET_TYPE_REALTIME_RAW_DATA:
      return "REALTIME_RAW_DATA";
    case PACKET_TYPE_HISTORICAL_DATA:
      return "HISTORICAL_DATA";
    case PACKET_TYPE_EVENT:
      return "EVENT";
    case PACKET_TYPE_METADATA:
      return "METADATA";
    case PACKET_TYPE_CONSOLE_LOGS:
      return "CONSOLE_LOGS";
    case PACKET_TYPE_REALTIME_IMU_DATA_STREAM:
      return "REALTIME_IMU_DATA_STREAM";
    case PACKET_TYPE_HISTORICAL_IMU_DATA_STREAM:
      return "HISTORICAL_IMU_DATA_STREAM";
    case PACKET_TYPE_RELATIVE_PUFFIN_EVENTS:
      return "RELATIVE_PUFFIN_EVENTS";
    case PACKET_TYPE_PUFFIN_EVENTS_FROM_STRAP:
      return "PUFFIN_EVENTS_FROM_STRAP";
    case PACKET_TYPE_RELATIVE_BATTERY_PACK_CONSOLE_LOGS:
      return "RELATIVE_BATTERY_PACK_CONSOLE_LOGS";
    case PACKET_TYPE_PUFFIN_METADATA:
      return "PUFFIN_METADATA";
    default:
      return undefined;
  }
}

export function parseFrameHex(device: DeviceType, hexValue: string): ParsedFrame {
  return parseFrame(device, decodeHexWithWhitespace(hexValue));
}

export function parseFrame(device: DeviceType, frame: Uint8Array): ParsedFrame {
  if (frame[0] !== FRAME_START) {
    throw new Error("frame does not start with 0xaa");
  }

  const hLen = headerLen(device);
  if (frame.length < hLen) {
    throw new Error(`frame shorter than ${hLen}-byte header`);
  }

  const declaredLen =
    device === "GEN4"
      ? frame[1]! | (frame[2]! << 8)
      : frame[2]! | (frame[3]! << 8);
  if (declaredLen < 4) {
    throw new Error("declared length must include at least the 4-byte payload CRC");
  }

  const headerCrcValid =
    device === "GEN4"
      ? crc8(frame.subarray(1, 3)) === frame[3]
      : crc16Modbus(frame.subarray(0, 6)) === (frame[6]! | (frame[7]! << 8));

  const expectedLen = hLen + declaredLen;
  if (frame.length > expectedLen) {
    throw new Error(
      `frame length ${frame.length} does not match declared length ${expectedLen}`,
    );
  }
  const frameTruncated = frame.length < expectedLen;
  const partialPacketType = byteAt(frame, hLen);
  if (
    frameTruncated &&
    (!headerCrcValid ||
      partialPacketType === undefined ||
      !isPartialDataPacketTypeAllowed(partialPacketType))
  ) {
    throw new Error(
      `frame length ${frame.length} does not match declared length ${expectedLen}`,
    );
  }

  let payload: Uint8Array;
  let payloadCrc: Uint8Array;
  let expectedPayloadCrc: Uint8Array | null;
  if (frameTruncated) {
    payload = frame.subarray(hLen);
    payloadCrc = new Uint8Array(0);
    expectedPayloadCrc = null;
  } else {
    const payloadEnd = frame.length - 4;
    payload = frame.subarray(hLen, payloadEnd);
    payloadCrc = frame.subarray(payloadEnd);
    expectedPayloadCrc = crc32LeBytes(payload);
  }
  const payloadCrcValid =
    expectedPayloadCrc !== null && bytesEqual(payloadCrc, expectedPayloadCrc);

  const warnings: string[] = [];
  if (frameTruncated) {
    warnings.push("frame_truncated");
    warnings.push("payload_crc_unavailable_due_to_truncated_frame");
  }
  if (!headerCrcValid) warnings.push("header_crc_mismatch");
  if (!payloadCrcValid && !frameTruncated) warnings.push("payload_crc_mismatch");

  const packetType = byteAt(payload, 0) ?? null;
  const parsedPayload = parsePayload(payload);
  if (parsedPayload) warnings.push(...parsedPayload.warnings);

  return {
    device_type: device,
    raw_len: frame.length,
    header_len: hLen,
    declared_len: declaredLen,
    payload_hex: encodeHex(payload),
    payload_crc_hex: encodeHex(payloadCrc),
    header_crc_valid: headerCrcValid,
    payload_crc_valid: payloadCrcValid,
    packet_type: packetType,
    packet_type_name:
      packetType !== null ? (packetTypeName(packetType) ?? null) : null,
    sequence: byteAt(payload, 1) ?? null,
    command_or_event: byteAt(payload, 2) ?? null,
    parsed_payload: parsedPayload,
    warnings,
  };
}

export function buildV5CommandFrame(
  sequence: number,
  command: number,
  data: Uint8Array,
): Uint8Array {
  const payload = new Uint8Array(3 + data.length);
  payload[0] = PACKET_TYPE_COMMAND;
  payload[1] = sequence & 0xff;
  payload[2] = command & 0xff;
  payload.set(data, 3);
  return buildV5PayloadFrame(payload);
}

export function buildV5PayloadFrame(payloadInput: Uint8Array): Uint8Array {
  const padding = paddingLen(payloadInput.length);
  const payload = new Uint8Array(payloadInput.length + padding);
  payload.set(payloadInput, 0); // trailing padding bytes remain 0

  const payloadCrc = crc32LeBytes(payload);
  const declaredLen = payload.length + payloadCrc.length;

  const header = new Uint8Array(6);
  header[0] = FRAME_START;
  header[1] = 0x01;
  header[2] = declaredLen & 0xff;
  header[3] = (declaredLen >>> 8) & 0xff;
  header[4] = 0x00;
  header[5] = 0x01;
  const headerCrc = crc16Modbus(header);

  const frame = new Uint8Array(8 + declaredLen);
  frame.set(header, 0);
  frame[6] = headerCrc & 0xff;
  frame[7] = (headerCrc >>> 8) & 0xff;
  frame.set(payload, 8);
  frame.set(payloadCrc, 8 + payload.length);
  return frame;
}

export function paddingLen(length: number): number {
  const remainder = length % 4;
  return remainder === 0 ? 0 : 4 - remainder;
}

function isPartialDataPacketTypeAllowed(packetType: number): boolean {
  return (
    packetType === PACKET_TYPE_REALTIME_DATA ||
    packetType === PACKET_TYPE_REALTIME_RAW_DATA ||
    packetType === PACKET_TYPE_HISTORICAL_DATA ||
    packetType === PACKET_TYPE_REALTIME_IMU_DATA_STREAM ||
    packetType === PACKET_TYPE_HISTORICAL_IMU_DATA_STREAM
  );
}

function parsePayload(payload: Uint8Array): ParsedPayload | null {
  const packetType = byteAt(payload, 0);
  if (packetType === undefined) return null;
  switch (packetType) {
    case PACKET_TYPE_COMMAND:
    case PACKET_TYPE_PUFFIN_COMMAND:
      return parseCommandPayload(payload);
    case PACKET_TYPE_COMMAND_RESPONSE:
    case PACKET_TYPE_PUFFIN_COMMAND_RESPONSE:
      return parseCommandResponsePayload(payload);
    case PACKET_TYPE_EVENT:
    case PACKET_TYPE_RELATIVE_PUFFIN_EVENTS:
    case PACKET_TYPE_PUFFIN_EVENTS_FROM_STRAP:
      return parseEventPayload(payload);
    case PACKET_TYPE_REALTIME_DATA:
    case PACKET_TYPE_REALTIME_RAW_DATA:
    case PACKET_TYPE_HISTORICAL_DATA:
    case PACKET_TYPE_REALTIME_IMU_DATA_STREAM:
    case PACKET_TYPE_HISTORICAL_IMU_DATA_STREAM:
      return parseDataPacketPayload(payload);
    default: {
      const offset = Math.min(1, payload.length);
      return {
        kind: "raw",
        data_offset: offset,
        data_hex: encodeHex(payload.subarray(offset)),
        warnings: [],
      };
    }
  }
}

function parseCommandPayload(payload: Uint8Array): ParsedPayload {
  const warnings: string[] = [];
  if (payload.length < 3) warnings.push("command_payload_too_short");
  const command = byteAt(payload, 2) ?? null;
  const offset = Math.min(3, payload.length);
  return {
    kind: "command",
    command,
    command_name: command !== null ? (commandName(command) ?? null) : null,
    data_offset: offset,
    data_hex: encodeHex(payload.subarray(offset)),
    warnings,
  };
}

function parseCommandResponsePayload(payload: Uint8Array): ParsedPayload {
  const warnings: string[] = [];
  if (payload.length < 5) warnings.push("command_response_payload_too_short");
  const responseToCommand = byteAt(payload, 2) ?? null;
  const offset = Math.min(5, payload.length);
  return {
    kind: "command_response",
    response_to_command: responseToCommand,
    response_to_command_name:
      responseToCommand !== null ? (commandName(responseToCommand) ?? null) : null,
    origin_sequence: byteAt(payload, 3) ?? null,
    result_code: byteAt(payload, 4) ?? null,
    data_offset: offset,
    data_hex: encodeHex(payload.subarray(offset)),
    warnings,
  };
}

function parseEventPayload(payload: Uint8Array): ParsedPayload {
  const warnings: string[] = [];
  if (payload.length < 12) warnings.push("event_payload_header_too_short");
  const eventId = readU16Le(payload, 2);
  const offset = Math.min(12, payload.length);
  return {
    kind: "event",
    event_id: eventId ?? null,
    event_name: eventId !== undefined ? (strapEventName(eventId) ?? null) : null,
    timestamp_seconds: readU32Le(payload, 4) ?? null,
    timestamp_subseconds: readU16Le(payload, 8) ?? null,
    data_offset: offset,
    data_hex: encodeHex(payload.subarray(offset)),
    warnings,
  };
}

function parseDataPacketPayload(payload: Uint8Array): ParsedPayload {
  const warnings: string[] = [];
  if (payload.length < 13) warnings.push("data_packet_header_too_short");
  const packetK = byteAt(payload, 1);
  const hrMarkerOffset = packetK !== undefined ? historyHrMarkerOffset(packetK) : undefined;
  const hrPresentMarker =
    hrMarkerOffset !== undefined ? byteAt(payload, hrMarkerOffset) : undefined;
  if (hrMarkerOffset !== undefined && hrPresentMarker === undefined) {
    warnings.push("history_hr_marker_missing");
  }
  const { summary, warnings: bodyWarnings } = parseDataPacketBodySummary(
    payload,
    packetK,
    hrMarkerOffset,
    hrPresentMarker,
  );
  warnings.push(...bodyWarnings);

  const offset = Math.min(13, payload.length);
  return {
    kind: "data_packet",
    packet_k: packetK ?? null,
    domain: packetK !== undefined ? (dataPacketDomain(packetK) ?? null) : null,
    status_or_stream: byteAt(payload, 2) ?? null,
    counter_or_page: readU32Le(payload, 3) ?? null,
    timestamp_seconds: readU32Le(payload, 7) ?? null,
    timestamp_subseconds: readU16Le(payload, 11) ?? null,
    hr_marker_offset: hrMarkerOffset ?? null,
    hr_present_marker: hrPresentMarker ?? null,
    body_offset: offset,
    body_hex: encodeHex(payload.subarray(offset)),
    body_summary: summary,
    warnings,
  };
}

function commandName(command: number): string | undefined {
  return command === COMMAND_GET_HELLO ? "GET_HELLO" : undefined;
}

function strapEventName(eventId: number): string | undefined {
  const names: Record<number, string> = {
    0: "UNDEFINED",
    1: "ERROR",
    2: "CONSOLE_OUTPUT",
    3: "BATTERY_LEVEL",
    4: "SYSTEM_CONTROL",
    7: "CHARGING_ON",
    8: "CHARGING_OFF",
    9: "WRIST_ON",
    10: "WRIST_OFF",
    11: "BLE_CONNECTION_UP",
    12: "BLE_CONNECTION_DOWN",
    13: "RTC_LOST",
    14: "DOUBLE_TAP",
    15: "BOOT",
    16: "SET_RTC",
    17: "TEMPERATURE_LEVEL",
    18: "PAIRING_MODE",
    28: "FLASH_INIT_COMPLETE",
    29: "STRAP_CONDITION_REPORT",
    33: "BLE_REALTIME_HR_ON",
    34: "BLE_REALTIME_HR_OFF",
    56: "STRAP_DRIVEN_ALARM_SET",
    57: "STRAP_DRIVEN_ALARM_EXECUTED",
    58: "APP_DRIVEN_ALARM_EXECUTED",
    59: "STRAP_DRIVEN_ALARM_DISABLED",
    60: "HAPTICS_FIRED",
    63: "EXTENDED_BATTERY_INFORMATION",
    96: "HIGH_FREQ_SYNC_PROMPT",
    97: "HIGH_FREQ_SYNC_ENABLED",
    98: "HIGH_FREQ_SYNC_DISABLED",
    100: "HAPTICS_TERMINATED",
    109: "BATTERY_PACK_INFO",
    123: "GENERIC_FIRMWARE_EVENT",
  };
  return names[eventId];
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
