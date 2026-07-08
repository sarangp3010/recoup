// Hex encode/decode helpers.

const HEX_CHARS = "0123456789abcdef";

export function encodeHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += HEX_CHARS[(byte >>> 4) & 0xf];
    out += HEX_CHARS[byte & 0xf];
  }
  return out;
}

export function decodeHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hex string has odd length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`invalid hex at offset ${i * 2}`);
    }
    out[i] = byte;
  }
  return out;
}

const WHITESPACE = /\s/;

/** Decode hex, tolerating ASCII whitespace between bytes. */
export function decodeHexWithWhitespace(hex: string): Uint8Array {
  if (!WHITESPACE.test(hex)) {
    return decodeHex(hex);
  }
  return decodeHex(hex.replace(/\s+/g, ""));
}
