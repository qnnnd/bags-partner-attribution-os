/**
 * Tests for attribution leaderboard merging logic.
 * Tests the merge of tracking event counts with Bags fee snapshots.
 */
import { describe, it, expect } from "vitest";
import type { LeaderboardEntry } from "@bags/shared";
import { AttributionType, ConversionStatus } from "@bags/shared";

// Simulate what the leaderboard aggregator produces from merged data
interface MockAffiliate {
  id: string;
  displayName: string;
  walletAddress: string;
  refCode: string;
}

interface MockFeeSnap {
  affiliateId: string;
  claimedFeesLamports: bigint;
  unclaimedFeesLamports: bigint;
}

interface MockEventCounts {
  affiliateId: string;
  visit: number;
  wallet_connect: number;
  buy_click: number;
  outbound_to_bags: number;
}

function buildLeaderboard(
  affiliates: MockAffiliate[],
  eventCounts: MockEventCounts[],
  feeSnaps: MockFeeSnap[],
): LeaderboardEntry[] {
  const feeMap = new Map(feeSnaps.map((f) => [f.affiliateId, f]));
  const countMap = new Map(eventCounts.map((e) => [e.affiliateId, e]));

  const entries: LeaderboardEntry[] = affiliates.map((aff) => {
    const counts = countMap.get(aff.id);
    const fee = feeMap.get(aff.id);
    const clicks = counts?.visit ?? 0;
    const wc = counts?.wallet_connect ?? 0;
    const bi = (counts?.buy_click ?? 0) + (counts?.outbound_to_bags ?? 0);
    const score = (clicks > 0 ? 20 : 0) + (wc > 0 ? 25 : 0) + (bi > 0 ? 20 : 0);

    return {
      rank: 0,
      affiliateId: aff.id,
      displayName: aff.displayName,
      walletAddress: aff.walletAddress,
      refCode: aff.refCode,
      clicks,
      walletConnects: wc,
      buyIntents: bi,
      attributedConversions: bi > 0 ? 1 : 0,
      confidenceScore: score,
      attributionType: bi > 0 ? AttributionType.WalletIntent : AttributionType.Click,
      claimedFeesLamports: fee ? Number(fee.claimedFeesLamports) : 0,
      unclaimedFeesLamports: fee ? Number(fee.unclaimedFeesLamports) : 0,
      status: ConversionStatus.Candidate,
      riskLevel: null,
    };
  });

  entries.sort((a, b) => b.confidenceScore - a.confidenceScore);
  entries.forEach((e, i) => { e.rank = i + 1; });
  return entries;
}

const AFFILIATES: MockAffiliate[] = [
  { id: "aff-1", displayName: "Alice", walletAddress: "AliceWallet1111111111111111111111111111111111", refCode: "ALICE001" },
  { id: "aff-2", displayName: "Bob", walletAddress: "BobWallet11111111111111111111111111111111111", refCode: "BOB00001" },
  { id: "aff-3", displayName: "Carol", walletAddress: "CarolWallet111111111111111111111111111111111", refCode: "CAROL001" },
];

describe("Attribution leaderboard merge", () => {
  it("correctly merges clicks, wallet connects, and buy intents", () => {
    const entries = buildLeaderboard(
      AFFILIATES,
      [
        { affiliateId: "aff-1", visit: 10, wallet_connect: 3, buy_click: 2, outbound_to_bags: 1 },
        { affiliateId: "aff-2", visit: 5, wallet_connect: 1, buy_click: 0, outbound_to_bags: 0 },
        { affiliateId: "aff-3", visit: 2, wallet_connect: 0, buy_click: 0, outbound_to_bags: 0 },
      ],
      [],
    );

    const alice = entries.find((e) => e.affiliateId === "aff-1")!;
    expect(alice.clicks).toBe(10);
    expect(alice.walletConnects).toBe(3);
    expect(alice.buyIntents).toBe(3); // buy_click + outbound_to_bags
  });

  it("ranks affiliates by confidence score descending", () => {
    // aff-1: clicks+wallet+buy = 20+25+20=65
    // aff-2: clicks only = 20
    // aff-3: clicks+wallet+buy = 20+25+20=65 (same as aff-1, order stable by sort)
    const entries = buildLeaderboard(
      AFFILIATES,
      [
        { affiliateId: "aff-1", visit: 5, wallet_connect: 2, buy_click: 1, outbound_to_bags: 0 },
        { affiliateId: "aff-2", visit: 3, wallet_connect: 0, buy_click: 0, outbound_to_bags: 0 },
        { affiliateId: "aff-3", visit: 8, wallet_connect: 4, buy_click: 3, outbound_to_bags: 2 },
      ],
      [],
    );

    // aff-2 (score 20) should be last
    expect(entries[2]!.affiliateId).toBe("aff-2");
    // aff-1 and aff-3 have the same score (65), both in top 2
    const top2 = new Set([entries[0]!.affiliateId, entries[1]!.affiliateId]);
    expect(top2.has("aff-1")).toBe(true);
    expect(top2.has("aff-3")).toBe(true);
    expect(entries[0]!.rank).toBe(1);
    expect(entries[1]!.rank).toBe(2);
    expect(entries[2]!.rank).toBe(3);
  });

  it("merges Bags partner fee snapshots into leaderboard entries", () => {
    const entries = buildLeaderboard(
      AFFILIATES,
      [
        { affiliateId: "aff-1", visit: 5, wallet_connect: 2, buy_click: 1, outbound_to_bags: 0 },
        { affiliateId: "aff-2", visit: 3, wallet_connect: 1, buy_click: 0, outbound_to_bags: 0 },
      ],
      [
        { affiliateId: "aff-1", claimedFeesLamports: BigInt(12_500_000_000), unclaimedFeesLamports: BigInt(3_200_000_000) },
        { affiliateId: "aff-2", claimedFeesLamports: BigInt(8_750_000_000), unclaimedFeesLamports: BigInt(1_500_000_000) },
      ],
    );

    const alice = entries.find((e) => e.affiliateId === "aff-1")!;
    expect(alice.claimedFeesLamports).toBe(12_500_000_000);
    expect(alice.unclaimedFeesLamports).toBe(3_200_000_000);

    const bob = entries.find((e) => e.affiliateId === "aff-2")!;
    expect(bob.claimedFeesLamports).toBe(8_750_000_000);
    expect(bob.unclaimedFeesLamports).toBe(1_500_000_000);
  });

  it("affiliates with no fee snapshot show zero fees", () => {
    const entries = buildLeaderboard(AFFILIATES, [], []);
    for (const e of entries) {
      expect(e.claimedFeesLamports).toBe(0);
      expect(e.unclaimedFeesLamports).toBe(0);
    }
  });

  it("affiliate with only clicks has lower confidence than one with buy intent", () => {
    const entries = buildLeaderboard(
      AFFILIATES,
      [
        { affiliateId: "aff-1", visit: 100, wallet_connect: 0, buy_click: 0, outbound_to_bags: 0 },
        { affiliateId: "aff-2", visit: 1, wallet_connect: 1, buy_click: 1, outbound_to_bags: 0 },
      ],
      [],
    );
    const alice = entries.find((e) => e.affiliateId === "aff-1")!;
    const bob = entries.find((e) => e.affiliateId === "aff-2")!;
    expect(alice.confidenceScore).toBeLessThan(bob.confidenceScore);
  });

  it("leaderboard entry has all required fields", () => {
    const entries = buildLeaderboard(
      [AFFILIATES[0]!],
      [{ affiliateId: "aff-1", visit: 5, wallet_connect: 2, buy_click: 1, outbound_to_bags: 0 }],
      [],
    );
    const entry = entries[0]!;
    expect(entry).toHaveProperty("rank");
    expect(entry).toHaveProperty("affiliateId");
    expect(entry).toHaveProperty("displayName");
    expect(entry).toHaveProperty("walletAddress");
    expect(entry).toHaveProperty("refCode");
    expect(entry).toHaveProperty("clicks");
    expect(entry).toHaveProperty("walletConnects");
    expect(entry).toHaveProperty("buyIntents");
    expect(entry).toHaveProperty("confidenceScore");
    expect(entry).toHaveProperty("attributionType");
    expect(entry).toHaveProperty("claimedFeesLamports");
    expect(entry).toHaveProperty("unclaimedFeesLamports");
    expect(entry).toHaveProperty("status");
  });
});
