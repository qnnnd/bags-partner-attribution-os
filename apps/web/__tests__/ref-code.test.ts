import { describe, it, expect } from "vitest";
import { generateRefCode, generateSlug } from "../lib/ref-code";

describe("generateRefCode", () => {
  it("returns an 8-character string", () => {
    expect(generateRefCode()).toHaveLength(8);
  });

  it("contains only URL-safe alphanumeric characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateRefCode()).toMatch(/^[A-Za-z2-9]{8}$/);
    }
  });

  it("generates unique codes across 1000 calls", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateRefCode()));
    // Expect at most 1 collision (highly unlikely with 8-char space of ~200 trillion combos)
    expect(codes.size).toBeGreaterThanOrEqual(999);
  });

  it("never contains ambiguous characters: 0, O, 1, l, I", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRefCode();
      expect(code).not.toMatch(/[01OlI]/);
    }
  });
});

describe("generateSlug", () => {
  it("returns a valid URL-safe slug", () => {
    const slug = generateSlug("BAGS Genesis Launch");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("includes a unique suffix", () => {
    const slugs = new Set(Array.from({ length: 50 }, () => generateSlug("My Campaign")));
    expect(slugs.size).toBeGreaterThanOrEqual(49);
  });

  it("handles special characters in name", () => {
    const slug = generateSlug("My Campaign #1 & More!");
    expect(slug).toMatch(/^[a-z0-9-]+$/);
  });

  it("truncates very long names", () => {
    const slug = generateSlug("a".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(50);
  });

  it("base is derived from the campaign name", () => {
    const slug = generateSlug("BAGS Genesis");
    expect(slug).toMatch(/^bags-genesis-/);
  });
});
