import { describe, it, expect } from "vitest";
import { MockBagsClient, MOCK_AFFILIATE_FIXTURES } from "../mock";
import { createBagsClient } from "../index";

const TOKEN_MINT = "MockToken11111111111111111111111111111111111";
const client = new MockBagsClient();

describe("MockBagsClient.getTokenLifetimeFees", () => {
  it("returns correct shape", async () => {
    const result = await client.getTokenLifetimeFees(TOKEN_MINT);
    expect(result.tokenMint).toBe(TOKEN_MINT);
    expect(typeof result.lifetimeFeesLamports).toBe("bigint");
    expect(result.lifetimeFeesLamports).toBeGreaterThan(BigInt(0));
    expect(result.lastUpdatedAt).toBeInstanceOf(Date);
  });
});

describe("MockBagsClient.getTokenClaimEvents", () => {
  it("returns 3 claim events", async () => {
    const events = await client.getTokenClaimEvents(TOKEN_MINT);
    expect(events).toHaveLength(MOCK_AFFILIATE_FIXTURES.length);
  });

  it("each event has correct shape", async () => {
    const events = await client.getTokenClaimEvents(TOKEN_MINT);
    for (const event of events) {
      expect(event.tokenMint).toBe(TOKEN_MINT);
      expect(typeof event.amountLamports).toBe("bigint");
      expect(event.amountLamports).toBeGreaterThan(BigInt(0));
      expect(event.txSignature).toBeTruthy();
      expect(event.claimedAt).toBeInstanceOf(Date);
    }
  });
});

describe("MockBagsClient.getPartnerConfig", () => {
  it("returns config for known affiliate wallet", async () => {
    const wallet = MOCK_AFFILIATE_FIXTURES[0]!.wallet;
    const config = await client.getPartnerConfig(wallet);
    expect(config).not.toBeNull();
    expect(config!.partnerWallet).toBe(wallet);
    expect(config!.feeBps).toBeGreaterThan(0);
    expect(config!.isActive).toBe(true);
  });

  it("returns null for unknown wallet", async () => {
    const result = await client.getPartnerConfig("UnknownWallet111111111111111111111111111111");
    expect(result).toBeNull();
  });
});

describe("MockBagsClient.getPartnerClaimStats", () => {
  it("returns correct stats for known affiliate", async () => {
    const fixture = MOCK_AFFILIATE_FIXTURES[0]!;
    const stats = await client.getPartnerClaimStats(fixture.wallet);
    expect(stats.partnerWallet).toBe(fixture.wallet);
    expect(stats.claimedFeesLamports).toBe(fixture.claimedLamports);
    expect(stats.unclaimedFeesLamports).toBe(fixture.unclaimedLamports);
    expect(stats.partnerConfigPda).toBe(fixture.pda);
  });

  it("returns zero fees for unknown wallet", async () => {
    const stats = await client.getPartnerClaimStats("UnknownWallet111111111111111111111111111111");
    expect(stats.claimedFeesLamports).toBe(BigInt(0));
    expect(stats.unclaimedFeesLamports).toBe(BigInt(0));
    expect(stats.partnerConfigPda).toBeNull();
  });

  it("includes raw field", async () => {
    const fixture = MOCK_AFFILIATE_FIXTURES[1]!;
    const stats = await client.getPartnerClaimStats(fixture.wallet);
    expect(stats.raw).toBeDefined();
    expect(stats.raw!.source).toBe("mock");
  });
});

describe("createBagsClient factory", () => {
  it("returns MockBagsClient when mode=mock", () => {
    const c = createBagsClient("mock");
    expect(c).toBeInstanceOf(MockBagsClient);
  });

  it("returns MainnetBagsClient for mainnet-readonly mode (Phase 2)", async () => {
    const { MainnetBagsClient } = await import("../mainnet");
    const c = createBagsClient("mainnet-readonly");
    expect(c).toBeInstanceOf(MainnetBagsClient);
  });

  it("returns MockBagsClient for any unknown/unsupported mode (safe fallback)", () => {
    // Unknown modes default to mock for safety
    const c = createBagsClient("some-unsupported-mode" as never);
    expect(c).toBeInstanceOf(MockBagsClient);
  });
});
