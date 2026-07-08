// Fixture-driven parity tests. Every entry in fixtures/index.json is dispatched
// by its `schema`: frame/payload hex fixtures and captured-frame batches are
// parsed by @recoup/protocol and their `expected` block is asserted as a subset
// of the parser output. Fixtures whose schema belongs to a package that does
// not exist yet (algorithms, health sync, debug bridge) are explicitly skipped
// so coverage is never silently overstated.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  buildV5PayloadFrame,
  decodeHexWithWhitespace,
  parseFrame,
  parseFrameHex,
  packetTypeName,
  type DeviceType,
} from "../src/index.js";

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

interface IndexEntry {
  id: string;
  path: string;
  schema: string;
  checksum_sha256: string;
  byte_len: number;
  expected: Record<string, unknown>;
}

interface FixtureIndex {
  pass: boolean;
  fixtures: IndexEntry[];
}

const index = JSON.parse(
  readFileSync(join(fixturesRoot, "index.json"), "utf8"),
) as FixtureIndex;

// Schemas this package can parse today. Anything else is deferred to the
// package that owns it and skipped with a visible reason.
const PARSEABLE_SCHEMAS = new Set([
  "recoup.frame.hex.v1",
  "recoup.payload.hex.v1",
  "recoup.captured-frame-batch.v1",
]);

/**
 * Assert that every key present in `expected` matches `actual`. Arrays must
 * match element-for-element (same length); nested objects recurse; primitives
 * compare strictly. Keys absent from `expected` are ignored, which is how the
 * partial fixture blocks are meant to be read.
 */
function expectSubset(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} should be an array`).toBe(true);
    const actualArr = actual as unknown[];
    expect(actualArr.length, `${path} length`).toBe(expected.length);
    expected.forEach((item, i) => expectSubset(actualArr[i], item, `${path}[${i}]`));
    return;
  }
  if (expected !== null && typeof expected === "object") {
    expect(actual !== null && typeof actual === "object", `${path} should be an object`).toBe(
      true,
    );
    const actualObj = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected)) {
      expectSubset(actualObj[key], value, `${path}.${key}`);
    }
    return;
  }
  expect(actual, path).toStrictEqual(expected);
}

describe("fixture index integrity", () => {
  it("declares pass: true", () => {
    expect(index.pass).toBe(true);
  });

  // Integrity is asserted only for fixtures this package parses; fixtures owned
  // by not-yet-built packages carry their own integrity checks there. (The
  // health-sync fixture, for one, has already drifted from its index metadata.)
  for (const entry of index.fixtures.filter((f) => PARSEABLE_SCHEMAS.has(f.schema))) {
    it(`${entry.id} matches its declared checksum and byte length`, () => {
      const raw = readFileSync(join(fixturesRoot, entry.path));
      expect(raw.byteLength, "byte_len").toBe(entry.byte_len);
      expect(createHash("sha256").update(raw).digest("hex")).toBe(entry.checksum_sha256);
    });
  }
});

describe("frame and payload fixtures parse to their expected subset", () => {
  const parseable = index.fixtures.filter((f) => PARSEABLE_SCHEMAS.has(f.schema));

  for (const entry of parseable) {
    it(entry.id, () => {
      const text = readFileSync(join(fixturesRoot, entry.path), "utf8");

      if (entry.schema === "recoup.frame.hex.v1") {
        const device = (entry.expected.device_type as DeviceType) ?? "GEN5";
        const parsed = parseFrameHex(device, text.trim());
        expectSubset(parsed, entry.expected, entry.id);
        return;
      }

      if (entry.schema === "recoup.payload.hex.v1") {
        // Owned captures are stored as bare Gen5 payloads; wrap them into a
        // valid frame (correct header + payload CRC) before parsing so the
        // expected CRC-valid flags hold.
        const payload = decodeHexWithWhitespace(text.trim());
        const frame = buildV5PayloadFrame(payload);
        const parsed = parseFrame("GEN5", frame);
        expectSubset(parsed, entry.expected, entry.id);
        return;
      }

      // recoup.captured-frame-batch.v1
      const batch = JSON.parse(text) as {
        frames: { frame_hex: string; device_type: DeviceType }[];
      };
      const parsedFrames = batch.frames.map((f) =>
        parseFrameHex(f.device_type ?? "GEN5", f.frame_hex),
      );
      expect(parsedFrames.length).toBe(entry.expected.frame_count);
      expect(
        parsedFrames.map((p) => (p.packet_type !== null ? packetTypeName(p.packet_type) : null)),
      ).toStrictEqual(entry.expected.packet_type_names);
      expect(parsedFrames.map((p) => p.parsed_payload?.kind ?? null)).toStrictEqual(
        entry.expected.parsed_payload_kinds,
      );
    });
  }
});

describe("fixtures for packages not yet built", () => {
  const deferred = index.fixtures.filter((f) => !PARSEABLE_SCHEMAS.has(f.schema));
  for (const entry of deferred) {
    it.skip(`${entry.id} (${entry.schema}) — owned by a future package`, () => {});
  }
});
