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
  const hex = x.toString(16).padStart(64, "0");
  const bytes = Buffer.from(hex, "hex");
  const leadingZeros = str.match(/^1*/)?.[0]?.length ?? 0;
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes]);
}
