/**
 * Content-based document fingerprinting.
 *
 * The filename is NOT a stable identity (renames are common). We hash the
 * raw PDF bytes with SHA-256, so the same document keeps its annotations
 * after a rename, and a genuinely different document is never confused with
 * an old one even if it shares a filename.
 */
const HEX = "0123456789abcdef";

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";

  for (const byte of bytes) {
    out += HEX[byte >> 4] + HEX[byte & 0x0f];
  }

  return out;
}

/** SHA-256 of the file bytes, as a lowercase hex string. */
export async function fingerprintBytes(bytes: ArrayBuffer): Promise<string> {
  // `crypto.subtle` exists in browsers and in Node >= 15 (globalThis).
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error("Web Crypto is unavailable: cannot fingerprint documents.");
  }

  const digest = await subtle.digest("SHA-256", bytes);
  return toHex(digest);
}
