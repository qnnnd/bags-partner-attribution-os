import * as ed from "@noble/ed25519";
import { randomBytes } from "crypto";

// @noble/ed25519 v3: configure synchronous SHA-512 via Node.js crypto (needed for sync path)
// Async functions (signAsync, verifyAsync, getPublicKeyAsync) use WebCrypto and don't require this.

export function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

export function buildSignMessage(nonce: string): string {
  return `Sign in to Bags Partner Attribution OS\n\nNonce: ${nonce}`;
}

/**
 * Verifies a Solana wallet signature (Ed25519).
 * @param walletAddress - base58-encoded public key
 * @param message - the plaintext message that was signed
 * @param signatureBase64 - base64-encoded 64-byte signature
 */
export async function verifyEd25519Signature(
  walletAddress: string,
  message: string,
  signatureBase64: string,
): Promise<boolean> {
  try {
    const { decode: base58Decode } = await import("./base58");
    const pubKeyBytes = base58Decode(walletAddress);
    const sigBytes = Buffer.from(signatureBase64, "base64");
    const msgBytes = new TextEncoder().encode(message);
    return await ed.verifyAsync(sigBytes, msgBytes, pubKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Signs a message with an Ed25519 private key (used in tests only).
 */
export async function signMessage(
  message: string,
  privateKeyHex: string,
): Promise<string> {
  const privKey = Buffer.from(privateKeyHex, "hex");
  const msgBytes = new TextEncoder().encode(message);
  const sig = await ed.signAsync(msgBytes, privKey);
  return Buffer.from(sig).toString("base64");
}

/**
 * Derives the public key (base58) from a 32-byte private key hex.
 */
export async function getPublicKeyBase58(privateKeyHex: string): Promise<string> {
  const { encode: base58Encode } = await import("./base58");
  const privKey = Buffer.from(privateKeyHex, "hex");
  const pubKey = await ed.getPublicKeyAsync(privKey);
  return base58Encode(pubKey);
}
