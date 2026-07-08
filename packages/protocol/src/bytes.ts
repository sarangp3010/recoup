// Bounds-checked little-endian readers. Out-of-bounds reads return `undefined`.

export function readU16Le(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 1 >= bytes.length) return undefined;
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

export function readU32Le(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 3 >= bytes.length) return undefined;
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

export function readI16Le(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 1 >= bytes.length) return undefined;
  const value = bytes[offset]! | (bytes[offset + 1]! << 8);
  return value >= 0x8000 ? value - 0x10000 : value;
}

/** Byte at offset, or undefined when out of bounds. */
export function byteAt(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset >= bytes.length) return undefined;
  return bytes[offset];
}
