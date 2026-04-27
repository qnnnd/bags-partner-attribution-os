/**
 * Unit tests for tx-validator.ts
 * Tests validateTxSignatureFormat (no network) and verifyTxOnChain (mock mode).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { validateTxSignatureFormat, verifyTxOnChain } from "../lib/tx-validator";

describe("validateTxSignatureFormat", () => {
  it("accepts a valid 87-character base58 signature", () => {
    // Construct a 87-char valid base58 string
    const sig = "A".repeat(87);
    const result = validateTxSignatureFormat(sig);
    // 'A' is in base58 alphabet
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("accepts a valid 88-character base58 signature", () => {
    const sig = "B".repeat(88);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(true);
  });

  it("rejects a signature that is too short (< 87 chars)", () => {
    const result = validateTxSignatureFormat("A".repeat(86));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("87");
  });

  it("rejects a signature that is too long (> 88 chars)", () => {
    const result = validateTxSignatureFormat("A".repeat(89));
    expect(result.valid).toBe(false);
    expect(result.error).toContain("89");
  });

  it("rejects a signature containing the character '0' (not in base58)", () => {
    const sig = "0".repeat(87);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(false);
  });

  it("rejects a signature containing 'O' (not in base58)", () => {
    const sig = "O".repeat(87);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(false);
  });

  it("rejects a signature containing 'I' (not in base58)", () => {
    const sig = "I".repeat(87);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(false);
  });

  it("rejects a signature containing 'l' (not in base58)", () => {
    const sig = "l".repeat(87);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = validateTxSignatureFormat("");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("rejects null", () => {
    const result = validateTxSignatureFormat(null);
    expect(result.valid).toBe(false);
  });

  it("rejects undefined", () => {
    const result = validateTxSignatureFormat(undefined);
    expect(result.valid).toBe(false);
  });

  it("rejects a number", () => {
    const result = validateTxSignatureFormat(12345);
    expect(result.valid).toBe(false);
  });

  it("accepts a realistic-looking 87-char base58 Solana signature", () => {
    // Realistic base58 characters: 1-9, A-H, J-N, P-Z, a-k, m-z
    const sig = "5xH9aVfTe7cR2sGbLkMpNqJuYwDzXiKoBhPnErCmWtFvSjUdAZQ1y4g6oN8x3Wr";
    // This is 65 chars — pad with valid chars to reach 87
    const padded = (sig + "1".repeat(87 - sig.length)).slice(0, 87);
    const result = validateTxSignatureFormat(padded);
    expect(result.valid).toBe(true);
  });

  it("trims whitespace before validating", () => {
    const sig = "  " + "A".repeat(87) + "  ";
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(true);
  });
});

describe("verifyTxOnChain (mock mode)", () => {
  beforeAll(() => {
    // Ensure mock mode
    delete process.env.BAGS_CLIENT_MODE;
  });
  afterAll(() => {
    delete process.env.BAGS_CLIENT_MODE;
  });

  it("returns exists=true in mock mode without network calls", async () => {
    const sig = "A".repeat(87);
    const result = await verifyTxOnChain(sig);
    expect(result.exists).toBe(true);
    expect(result.confirmationStatus).toBe("finalized");
    expect(result.err).toBeNull();
  });

  it("returns slot as a number in mock mode", async () => {
    const result = await verifyTxOnChain("B".repeat(87));
    expect(typeof result.slot).toBe("number");
  });

  it("never throws in mock mode", async () => {
    await expect(verifyTxOnChain("C".repeat(88))).resolves.not.toThrow();
  });
});
