import { describe, it, expect } from "vitest";

/**
 * Unit tests for tracking payload validation logic.
 * These test the Zod schema from tracking-handler.ts without making DB calls.
 */
import { TrackingBody } from "../lib/tracking-handler";

describe("TrackingBody validation", () => {
  it("accepts a minimal valid payload", () => {
    const result = TrackingBody.safeParse({
      campaignId: "campaign-123",
      sessionId: "session-abc",
    });
    expect(result.success).toBe(true);
  });

  it("accepts full payload with all optional fields", () => {
    const result = TrackingBody.safeParse({
      campaignId: "campaign-123",
      sessionId: "session-abc",
      refCode: "ALICE42",
      walletAddress: "AliceWallet1111111111111111111111111111111111",
      metadata: { referrer: "https://example.com" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing campaignId", () => {
    const result = TrackingBody.safeParse({ sessionId: "session-abc" });
    expect(result.success).toBe(false);
  });

  it("rejects missing sessionId", () => {
    const result = TrackingBody.safeParse({ campaignId: "campaign-123" });
    expect(result.success).toBe(false);
  });

  it("rejects empty sessionId", () => {
    const result = TrackingBody.safeParse({ campaignId: "campaign-123", sessionId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects walletAddress that is too short", () => {
    const result = TrackingBody.safeParse({
      campaignId: "campaign-123",
      sessionId: "session-abc",
      walletAddress: "short",
    });
    expect(result.success).toBe(false);
  });

  it("allows null walletAddress", () => {
    const result = TrackingBody.safeParse({
      campaignId: "campaign-123",
      sessionId: "session-abc",
      walletAddress: null,
    });
    expect(result.success).toBe(true);
  });

  it("allows null refCode", () => {
    const result = TrackingBody.safeParse({
      campaignId: "campaign-123",
      sessionId: "session-abc",
      refCode: null,
    });
    expect(result.success).toBe(true);
  });

  it("sessionId can associate multiple event types", () => {
    const sharedSession = "shared-session-xyz";
    const events = ["visit", "wallet_connect", "buy_click"].map((type) =>
      TrackingBody.safeParse({ campaignId: "c1", sessionId: sharedSession, metadata: { type } }),
    );
    for (const result of events) {
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.sessionId).toBe(sharedSession);
    }
  });
});
