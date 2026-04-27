import { describe, it, expect } from "vitest";
import { generateNonce, buildSignMessage, verifyEd25519Signature, signMessage, getPublicKeyBase58 } from "../lib/auth";
import { randomBytes } from "crypto";

describe("generateNonce", () => {
  it("returns a 32-char hex string", () => {
    const nonce = generateNonce();
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
  });

  it("generates unique nonces", () => {
    const nonces = new Set(Array.from({ length: 100 }, () => generateNonce()));
    expect(nonces.size).toBe(100);
  });
});

describe("buildSignMessage", () => {
  it("includes the nonce in the message", () => {
    const nonce = "abc123def456";
    const msg = buildSignMessage(nonce);
    expect(msg).toContain(nonce);
    expect(msg).toContain("Bags Partner Attribution OS");
  });

  it("is deterministic for the same nonce", () => {
    const nonce = generateNonce();
    expect(buildSignMessage(nonce)).toBe(buildSignMessage(nonce));
  });
});

describe("verifyEd25519Signature", () => {
  it("returns true for a valid signature", async () => {
    const privKeyHex = randomBytes(32).toString("hex");
    const publicKey = await getPublicKeyBase58(privKeyHex);
    const message = buildSignMessage(generateNonce());
    const signature = await signMessage(message, privKeyHex);

    const valid = await verifyEd25519Signature(publicKey, message, signature);
    expect(valid).toBe(true);
  });

  it("returns false for wrong message", async () => {
    const privKeyHex = randomBytes(32).toString("hex");
    const publicKey = await getPublicKeyBase58(privKeyHex);
    const message = buildSignMessage(generateNonce());
    const signature = await signMessage(message, privKeyHex);

    const valid = await verifyEd25519Signature(publicKey, "wrong message", signature);
    expect(valid).toBe(false);
  });

  it("returns false for wrong public key", async () => {
    const privKeyHex = randomBytes(32).toString("hex");
    const otherPrivKeyHex = randomBytes(32).toString("hex");
    const wrongPublicKey = await getPublicKeyBase58(otherPrivKeyHex);
    const message = buildSignMessage(generateNonce());
    const signature = await signMessage(message, privKeyHex);

    const valid = await verifyEd25519Signature(wrongPublicKey, message, signature);
    expect(valid).toBe(false);
  });

  it("returns false for malformed signature", async () => {
    const privKeyHex = randomBytes(32).toString("hex");
    const publicKey = await getPublicKeyBase58(privKeyHex);
    const message = buildSignMessage(generateNonce());

    const valid = await verifyEd25519Signature(publicKey, message, "not-a-valid-signature");
    expect(valid).toBe(false);
  });
});
