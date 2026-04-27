import { describe, it, expect } from "vitest";
import { MOCK_LEADERBOARD, MOCK_CAMPAIGN } from "../lib/mock-data";
import { AttributionType, ConversionStatus } from "@bags/shared";

/**
 * Unit tests for the leaderboard data layer.
 * These test the mock data shape and sorting invariants that the
 * /api/attribution/campaign/[id]/leaderboard route relies on.
 */
describe("Mock leaderboard data", () => {
  it("has exactly 3 entries", () => {
    expect(MOCK_LEADERBOARD).toHaveLength(3);
  });

  it("entries are sorted by rank ascending", () => {
    const ranks = MOCK_LEADERBOARD.map((e) => e.rank);
    expect(ranks).toEqual([1, 2, 3]);
  });

  it("entries are sorted by confidenceScore descending", () => {
    const scores = MOCK_LEADERBOARD.map((e) => e.confidenceScore);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]!).toBeGreaterThanOrEqual(scores[i + 1]!);
    }
  });

  it("all entries have required fields", () => {
    for (const entry of MOCK_LEADERBOARD) {
      expect(entry.affiliateId).toBeTruthy();
      expect(entry.displayName).toBeTruthy();
      expect(entry.walletAddress).toBeTruthy();
      expect(entry.refCode).toBeTruthy();
      expect(entry.clicks).toBeGreaterThan(0);
      expect(entry.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(entry.confidenceScore).toBeLessThanOrEqual(100);
    }
  });

  it("top affiliate has highest confidence score and confirmed status", () => {
    const top = MOCK_LEADERBOARD[0]!;
    expect(top.confidenceScore).toBeGreaterThanOrEqual(80);
    expect(top.status).toBe(ConversionStatus.Confirmed);
    expect(top.attributionType).toBe(AttributionType.OnchainCandidate);
  });

  it("all fee values are non-negative numbers or bigints", () => {
    for (const entry of MOCK_LEADERBOARD) {
      const claimed = Number(entry.claimedFeesLamports);
      const unclaimed = Number(entry.unclaimedFeesLamports);
      expect(claimed).toBeGreaterThanOrEqual(0);
      expect(unclaimed).toBeGreaterThanOrEqual(0);
    }
  });

  it("ref codes are unique across affiliates", () => {
    const codes = MOCK_LEADERBOARD.map((e) => e.refCode);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("wallet addresses are unique across affiliates", () => {
    const wallets = MOCK_LEADERBOARD.map((e) => e.walletAddress);
    const unique = new Set(wallets);
    expect(unique.size).toBe(wallets.length);
  });
});

describe("Mock campaign data", () => {
  it("has required fields", () => {
    expect(MOCK_CAMPAIGN.id).toBeTruthy();
    expect(MOCK_CAMPAIGN.name).toBeTruthy();
    expect(MOCK_CAMPAIGN.tokenMint).toBeTruthy();
    expect(MOCK_CAMPAIGN.slug).toBeTruthy();
    expect(MOCK_CAMPAIGN.attributionWindowMinutes).toBe(1440);
  });

  it("stats are positive numbers", () => {
    const { stats } = MOCK_CAMPAIGN;
    expect(stats.totalClicks).toBeGreaterThan(0);
    expect(stats.walletConnects).toBeGreaterThan(0);
    expect(stats.buyIntents).toBeGreaterThan(0);
    expect(stats.lifetimeFeesLamports).toBeGreaterThan(0);
  });
});
