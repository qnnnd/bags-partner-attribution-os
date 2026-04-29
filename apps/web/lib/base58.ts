// Minimal base58 encode/decode for Solana public keys
// Avoids pulling in the full @solana/web3.js SDK

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  ALPHABET_MAP[ALPHABET[i]!] = i;
}

export function encode(bytes: Uint8Array): string {
  let x = BigInt("0x" + Buffer.from(bytes).toString("hex") || "0");
  let out = "";
  while (x > BigInt(0)) {
    const rem = Number(x % BigInt(58));
    x = x / BigInt(58);
    out = ALPHABET[rem]! + out;
  }
  for (const byte of bytes) {
    if (byte === 0) out = "1" + out;
    else break;
  }
  return out;
}

export function decode(str: string): Uint8Array {
  let x = BigInt(0);
  for (const ch of str) {
    const digit = ALPHABET_MAP[ch];
    if (digit === undefined) throw new Error(`Invalid base58 character: ${ch}`);
    x = x * BigInt(58) + BigInt(digit);
  }
  // Convert BigInt to minimal bytes without forced-length padding.
  // Forced padding (e.g. padStart(64)) double-counts leading zero bytes
  // that are already captured by the leading '1' characters in the string.
  let hex = x === BigInt(0) ? "" : x.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const bytes = hex.length > 0 ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  // Each leading '1' in base58 represents one 0x00 byte
  const leadingZeros = str.match(/^1*/)?.[0]?.length ?? 0;
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}
