import { describe, it, expect } from "vitest";
import {
  AttributionType,
  ConversionStatus,
  SCORE_MODIFIERS,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
} from "@bags/shared";
import { computeScore, resolveStatus, buildReason, applyLastTouch } from "../scoring";
import type { AttributionInput, AttributionResult } from "../types";

const BASE_INPUT: AttributionInput = {
  campaignId: "campaign-1",
  affiliateId: "affiliate-1",
  affiliateWallet: "AffiliateWallet1111111111111111111111111",
  tokenMint: "MockToken11111111111111111111111111111111111",
  attributionWindowMinutes: 1440,
  signals: [],
};

function makeSignal(
  overrides: Partial<AttributionInput["signals"][0]> = {},
): AttributionInput["signals"][0] {
  return {
    sessionId: "session-1",
    affiliateId: "affiliate-1",
    refCode: "REF001",
    hasWalletConnect: false,
    hasBuyClick: false,
    hasOnchainCandidate: false,
    visitCount: 1,
    firstSeenAt: new Date("2026-04-27T00:00:00Z"),
    lastSeenAt: new Date("2026-04-27T01:00:00Z"),
    ...overrides,
  };
}

describe("computeScore", () => {
  it("returns zero score for empty signals", () => {
    const { score } = computeScore(BASE_INPUT);
    expect(score).toBe(0);
  });

  it("awards +20 for valid ref link visit", () => {
    const { score } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ visitCount: 1 })],
    });
    expect(score).toBeGreaterThanOrEqual(SCORE_MODIFIERS.VALID_REF_LINK);
  });

  it("awards +20 for no repeated clicks", () => {
    const input = {
      ...BASE_INPUT,
      signals: [makeSignal({ visitCount: 1 })],
    };
    const { breakdown } = computeScore(input);
    expect(breakdown.noRepeatedClicks).toBe(SCORE_MODIFIERS.NO_REPEATED_CLICKS);
  });

  it("awards +25 for wallet connect", () => {
    const { breakdown } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ hasWalletConnect: true })],
    });
    expect(breakdown.walletConnect).toBe(SCORE_MODIFIERS.WALLET_CONNECT);
  });

  it("awards +20 for buy click", () => {
    const { breakdown } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ hasBuyClick: true })],
    });
    expect(breakdown.buyClick).toBe(SCORE_MODIFIERS.BUY_CLICK);
  });

  it("awards +25 for on-chain candidate", () => {
    const { breakdown } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ hasOnchainCandidate: true })],
    });
    expect(breakdown.onchainCandidate).toBe(SCORE_MODIFIERS.ONCHAIN_CANDIDATE);
  });

  it("applies -30 self-buy penalty when buyer == affiliate wallet", () => {
    const { breakdown } = computeScore({
      ...BASE_INPUT,
      buyerWallet: "AffiliateWallet1111111111111111111111111",
      signals: [makeSignal({ hasWalletConnect: true, hasBuyClick: true })],
    });
    expect(breakdown.selfBuyPenalty).toBe(SCORE_MODIFIERS.SELF_BUY);
  });

  it("reaches high-confidence score with full signals", () => {
    const { score } = computeScore({
      ...BASE_INPUT,
      signals: [
        makeSignal({
          hasWalletConnect: true,
          hasBuyClick: true,
          hasOnchainCandidate: true,
          visitCount: 1,
        }),
      ],
    });
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_HIGH);
  });

  it("score is capped at 0 minimum (never negative)", () => {
    const { score } = computeScore({
      ...BASE_INPUT,
      buyerWallet: "AffiliateWallet1111111111111111111111111",
      signals: [makeSignal({ visitCount: 0 })],
    });
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("detects repeated click penalty when threshold exceeded in window", () => {
    const windowStart = new Date("2026-04-27T00:00:00Z");
    const windowEnd = new Date("2026-04-27T00:09:00Z"); // within 10 min
    const { breakdown } = computeScore({
      ...BASE_INPUT,
      signals: [
        makeSignal({
          visitCount: 10,
          firstSeenAt: windowStart,
          lastSeenAt: windowEnd,
        }),
      ],
    });
    expect(breakdown.repeatedClickPenalty).toBe(SCORE_MODIFIERS.REPEATED_CLICK);
    expect(breakdown.noRepeatedClicks).toBe(0);
  });

  it("sets attribution type to OnchainCandidate when on-chain signal present", () => {
    const { attributionType } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ hasOnchainCandidate: true })],
    });
    expect(attributionType).toBe(AttributionType.OnchainCandidate);
  });

  it("sets attribution type to WalletIntent when wallet connected but no on-chain", () => {
    const { attributionType } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ hasWalletConnect: true })],
    });
    expect(attributionType).toBe(AttributionType.WalletIntent);
  });

  it("sets attribution type to Click when only visit signals", () => {
    const { attributionType } = computeScore({
      ...BASE_INPUT,
      signals: [makeSignal({ visitCount: 1 })],
    });
    expect(attributionType).toBe(AttributionType.Click);
  });
});

describe("resolveStatus", () => {
  it("returns Confirmed for score >= 80 with no risk", () => {
    expect(resolveStatus(90, false, false)).toBe(ConversionStatus.Confirmed);
  });

  it("returns Candidate for medium-confidence score", () => {
    expect(resolveStatus(60, false, false)).toBe(ConversionStatus.Candidate);
  });

  it("returns Suspicious for self-buy regardless of score", () => {
    expect(resolveStatus(90, true, false)).toBe(ConversionStatus.Suspicious);
  });

  it("returns Suspicious for high-risk flag", () => {
    expect(resolveStatus(70, false, true)).toBe(ConversionStatus.Suspicious);
  });
});

describe("buildReason", () => {
  it("includes attribution type and score in reason string", () => {
    const reason = buildReason(
      85,
      {
        base: 0,
        validRefLink: 20,
        noRepeatedClicks: 20,
        walletConnect: 25,
        buyClick: 20,
        onchainCandidate: 25,
        selfBuyPenalty: 0,
        repeatedClickPenalty: 0,
        total: 85,
      },
      AttributionType.OnchainCandidate,
    );
    expect(reason).toContain("85");
    expect(reason).toContain("onchain_candidate");
  });
});

describe("attribution window", () => {
  it("empty signals produce zero score (simulates all events outside window)", () => {
    // When the aggregator filters events outside the attribution window,
    // it passes no signals to computeScore → score must be 0.
    const { score, attributionType } = computeScore({
      ...BASE_INPUT,
      signals: [],
    });
    expect(score).toBe(0);
    expect(attributionType).toBe(AttributionType.Click);
  });

  it("signals within window still score correctly", () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 60 * 1000); // 1h ago
    const { score } = computeScore({
      ...BASE_INPUT,
      attributionWindowMinutes: 60,
      signals: [
        makeSignal({
          firstSeenAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago (within window)
          lastSeenAt: now,
          hasWalletConnect: true,
          hasBuyClick: true,
          visitCount: 1,
        }),
      ],
    });
    // +20 ref link, +20 no repeated, +25 wallet, +20 buy click = 85
    expect(score).toBeGreaterThanOrEqual(CONFIDENCE_MEDIUM);
    void windowStart; // window boundary is enforced by aggregator, not scorer
  });
});

describe("applyLastTouch", () => {
  const makeResult = (
    affiliateId: string,
    buyerWallet: string,
    confidenceScore: number,
    lastSignalAt?: Date,
  ): AttributionResult => ({
    campaignId: "campaign-1",
    affiliateId,
    buyerWallet,
    tokenMint: "MockToken",
    attributionType: AttributionType.Click,
    confidenceScore,
    scoreBreakdown: {
      base: 0,
      validRefLink: 0,
      noRepeatedClicks: 0,
      walletConnect: 0,
      buyClick: 0,
      onchainCandidate: 0,
      selfBuyPenalty: 0,
      repeatedClickPenalty: 0,
      total: confidenceScore,
    },
    status: ConversionStatus.Candidate,
    reason: "test",
    isLastTouch: false,
    lastSignalAt,
  });

  it("marks single result as last touch", () => {
    const results = applyLastTouch([makeResult("aff-1", "buyer-1", 80)]);
    expect(results[0]!.isLastTouch).toBe(true);
  });

  it("only highest-confidence result gets last-touch for same buyer (no timestamps)", () => {
    const results = applyLastTouch([
      makeResult("aff-1", "buyer-1", 60),
      makeResult("aff-2", "buyer-1", 85),
    ]);
    const lastTouchResults = results.filter((r) => r.isLastTouch);
    expect(lastTouchResults).toHaveLength(1);
    expect(lastTouchResults[0]!.confidenceScore).toBe(85);
    expect(lastTouchResults[0]!.affiliateId).toBe("aff-2");
  });

  it("different buyers each get their own last-touch result", () => {
    const results = applyLastTouch([
      makeResult("aff-1", "buyer-1", 80),
      makeResult("aff-2", "buyer-2", 70),
    ]);
    const lastTouchResults = results.filter((r) => r.isLastTouch);
    expect(lastTouchResults).toHaveLength(2);
  });

  // ── Timestamp-based last-touch ordering ────────────────────────────────────

  it("selects affiliate with later lastSignalAt even if confidence is lower", () => {
    const earlier = new Date("2026-04-27T10:00:00Z");
    const later = new Date("2026-04-27T11:00:00Z");
    // aff-1 clicked earlier with higher score; aff-2 clicked later with lower score
    const results = applyLastTouch([
      makeResult("aff-1", "buyer-1", 85, earlier),
      makeResult("aff-2", "buyer-1", 60, later),
    ]);
    const lastTouch = results.find((r) => r.isLastTouch)!;
    expect(lastTouch.affiliateId).toBe("aff-2");
    expect(results.find((r) => r.affiliateId === "aff-1")!.isLastTouch).toBe(false);
  });

  it("same session: A clicked first, B clicked later — B wins (last-touch)", () => {
    const tA = new Date("2026-04-27T08:00:00Z");
    const tB = new Date("2026-04-27T09:30:00Z");
    const results = applyLastTouch([
      makeResult("aff-A", "buyer-1", 65, tA),
      makeResult("aff-B", "buyer-1", 65, tB),
    ]);
    const lastTouch = results.find((r) => r.isLastTouch)!;
    expect(lastTouch.affiliateId).toBe("aff-B");
  });

  it("same wallet: connected to A first, then connected to B — B wins", () => {
    const tA = new Date("2026-04-27T12:00:00Z");
    const tB = new Date("2026-04-27T12:30:00Z");
    const results = applyLastTouch([
      makeResult("aff-A", "wallet-W", 80, tA),
      makeResult("aff-B", "wallet-W", 80, tB),
    ]);
    const lastTouch = results.find((r) => r.isLastTouch)!;
    expect(lastTouch.affiliateId).toBe("aff-B");
  });

  it("A has click but B has wallet intent (later timestamp) — B wins", () => {
    const tA = new Date("2026-04-27T10:00:00Z");
    const tB = new Date("2026-04-27T10:05:00Z");
    const results = applyLastTouch([
      makeResult("aff-A", "wallet-W", 20, tA),  // click only
      makeResult("aff-B", "wallet-W", 65, tB),  // wallet intent, later
    ]);
    const lastTouch = results.find((r) => r.isLastTouch)!;
    expect(lastTouch.affiliateId).toBe("aff-B");
    expect(results.find((r) => r.affiliateId === "aff-A")!.isLastTouch).toBe(false);
  });

  it("non-last-touch affiliate has isLastTouch=false", () => {
    const tA = new Date("2026-04-27T10:00:00Z");
    const tB = new Date("2026-04-27T11:00:00Z");
    const results = applyLastTouch([
      makeResult("aff-A", "buyer-1", 70, tA),
      makeResult("aff-B", "buyer-1", 70, tB),
    ]);
    expect(results.find((r) => r.affiliateId === "aff-A")!.isLastTouch).toBe(false);
    expect(results.find((r) => r.affiliateId === "aff-B")!.isLastTouch).toBe(true);
  });
});
