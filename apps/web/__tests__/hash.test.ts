import { describe, it, expect } from "vitest";
import { hashString } from "../lib/hash";

describe("hashString", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashString("test-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashString("same-input")).toBe(hashString("same-input"));
  });

  it("returns different hashes for different inputs", () => {
    expect(hashString("input-1")).not.toBe(hashString("input-2"));
  });

  it("incorporates salt (different from unsalted SHA-256)", () => {
    const { createHash } = require("crypto");
    const rawHash = createHash("sha256").update("test-value").digest("hex");
    const saltedHash = hashString("test-value");
    // Since HASH_SALT is non-empty in test env, they should differ
    expect(rawHash).not.toBe(saltedHash);
  });

  it("handles empty string input", () => {
    const hash = hashString("");
    expect(hash).toHaveLength(64);
  });

  it("handles unicode input", () => {
    const hash = hashString("日本語テスト");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
