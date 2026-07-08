// Device types and the streaming frame accumulator.

export const FRAME_START = 0xaa;

/** SCREAMING_SNAKE_CASE to match the identifiers used in fixtures. */
export type DeviceType = "GEN4" | "MAVERICK" | "PUFFIN" | "GEN5";

export function headerLen(device: DeviceType): number {
  return device === "GEN4" ? 4 : 8;
}

/**
 * Total expected frame length given the bytes seen so far, or undefined if the
 * header is not yet complete. Gen4 declares length at bytes[1..3] + 4-byte
 * header; Gen5+ declares at bytes[2..4] + 8-byte header.
 */
export function expectedFrameLen(
  device: DeviceType,
  buffer: Uint8Array,
): number | undefined {
  if (device === "GEN4") {
    if (buffer.length < 4) return undefined;
    return (buffer[1]! | (buffer[2]! << 8)) + 4;
  }
  if (buffer.length < 8) return undefined;
  return (buffer[2]! | (buffer[3]! << 8)) + 8;
}

export interface DeframeResult {
  frames: Uint8Array[];
  buffered_len: number;
  dropped_prefix_len: number;
}

/**
 * Streaming deframer. Resyncs to the next 0xAA on junk, and emits complete
 * frames once their declared length is buffered.
 */
export class FrameAccumulator {
  private buffer: Uint8Array = new Uint8Array(0);

  constructor(private readonly device: DeviceType) {}

  feed(chunk: Uint8Array): DeframeResult {
    this.buffer = concat(this.buffer, chunk);
    const frames: Uint8Array[] = [];
    let dropped = this.dropUntilFrameStart();

    for (;;) {
      const expectedLen = expectedFrameLen(this.device, this.buffer);
      if (expectedLen === undefined) break;
      if (this.buffer.length < expectedLen) break;
      frames.push(this.buffer.slice(0, expectedLen));
      this.buffer = this.buffer.slice(expectedLen);
      dropped += this.dropUntilFrameStart();
    }

    return {
      frames,
      buffered_len: this.buffer.length,
      dropped_prefix_len: dropped,
    };
  }

  private dropUntilFrameStart(): number {
    const start = this.buffer.indexOf(FRAME_START);
    if (start === 0) return 0;
    if (start > 0) {
      this.buffer = this.buffer.slice(start);
      return start;
    }
    const dropped = this.buffer.length;
    this.buffer = new Uint8Array(0);
    return dropped;
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length === 0) return b.slice();
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
