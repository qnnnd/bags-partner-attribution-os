/**
 * Tests for MainnetBagsClient behaviour in fixture fallback mode.
 * These tests do NOT make real network calls — they use demo fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MainnetBagsClient } from "../mainnet";
import { DEMO_FIXTURE_TOKEN_MINT, DEMO_FIXTURE_TOKEN_FEES } from "../fixtures";

// Force fixture fallback for all tests in this file
beforeAll(() => {
  process.env.BAGS_ENABLE_FIXTURE_FALLBACK = "true";
});
afterAll(() => {
  delete process.env.BAGS_ENABLE_FIXTURE_FALLBACK;
});

const KNOWN_WALLET = "AliceWallet1111111111111111111111111111111111";
const UNKNOWN_WALLET = "UnknownWallet111111111111111111111111111111";

describe("MainnetBagsClient (fixture fallback)", () => {
  const client = new MainnetBagsClient();

  it("getTokenLifetimeFees returns correct shape", async () => {
    const result = await client.getTokenLifetimeFees(DEMO_FIXTURE_TOKEN_MINT);
    expect(result.tokenMint).toBe(DEMO_FIXTURE_TOKEN_MINT);
    expect(typeof result.lifetimeFeesLamports).toBe("bigint");
    expect(result.lifetimeFeesLamports).toBeGreaterThan(BigInt(0));
    expect(result.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("getTokenLifetimeFees fixture matches expected fee amount", async () => {
    const result = await client.getTokenLifetimeFees(DEMO_FIXTURE_TOKEN_MINT);
    expect(result.lifetimeFeesLamports).toBe(DEMO_FIXTURE_TOKEN_FEES.lifetimeFeesLamports);
  });

  it("getTokenClaimEvents returns array of events", async () => {
    const events = await client.getTokenClaimEvents(DEMO_FIXTURE_TOKEN_MINT);
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.tokenMint).toBe(DEMO_FIXTURE_TOKEN_MINT);
      expect(typeof e.amountLamports).toBe("bigint");
      expect(e.claimerWallet).toBeTruthy();
      expect(e.txSignature).toBeTruthy();
      expect(e.claimedAt).toBeInstanceOf(Date);
    }
  });

  it("getTokenClaimEvents sum matches total claimed per fixture", async () => {
    const events = await client.getTokenClaimEvents(DEMO_FIXTURE_TOKEN_MINT);
    const totalClaimed = events.reduce((s, e) => s + e.amountLamports, BigInt(0));
    // 12.5 + 8.75 + 4.2 = 25.45 SOL
    expect(totalClaimed).toBe(BigInt(25_450_000_000));
  });

  it("getPartnerConfig returns config for known wallet", async () => {
    const config = await client.getPartnerConfig(KNOWN_WALLET);
    expect(config).not.toBeNull();
    expect(config!.partnerWallet).toBe(KNOWN_WALLET);
    expect(config!.partnerConfigPda).toBeTruthy();
    expect(config!.feeBps).toBeGreaterThan(0);
    expect(config!.isActive).toBe(true);
  });

  it("getPartnerConfig returns null for unknown wallet", async () => {
    const config = await client.getPartnerConfig(UNKNOWN_WALLET);
    expect(config).toBeNull();
  });

  it("getPartnerClaimStats returns claimed/unclaimed for known wallet", async () => {
    const stats = await client.getPartnerClaimStats(KNOWN_WALLET);
    expect(stats.partnerWallet).toBe(KNOWN_WALLET);
    expect(typeof stats.claimedFeesLamports).toBe("bigint");
    expect(typeof stats.unclaimedFeesLamports).toBe("bigint");
    expect(stats.claimedFeesLamports).toBe(BigInt(12_500_000_000));
    expect(stats.unclaimedFeesLamports).toBe(BigInt(3_200_000_000));
  });

  it("getPartnerClaimStats returns zero fees for unknown wallet", async () => {
    const stats = await client.getPartnerClaimStats(UNKNOWN_WALLET);
    expect(stats.claimedFeesLamports).toBe(BigInt(0));
    expect(stats.unclaimedFeesLamports).toBe(BigInt(0));
    expect(stats.partnerConfigPda).toBeNull();
  });
});
