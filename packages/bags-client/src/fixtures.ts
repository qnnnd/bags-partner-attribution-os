/**
 * Demo fixtures for Phase 2 fallback.
 * Used when mainnet API is unreachable or in demo mode.
 * These represent realistic Bags mainnet-beta data shapes.
 */
import type { TokenFeeStats, TokenClaimEvent, PartnerConfig, PartnerClaimStats } from "./types";

export const DEMO_FIXTURE_TOKEN_MINT =
  "So11111111111111111111111111111111111111112"; // Wrapped SOL as placeholder

export const DEMO_FIXTURE_TOKEN_FEES: TokenFeeStats = {
  tokenMint: DEMO_FIXTURE_TOKEN_MINT,
  lifetimeFeesLamports: BigInt(250_000_000_000), // 250 SOL
  lastUpdatedAt: new Date("2026-04-27T00:00:00Z"),
  raw: { source: "fixture", note: "demo fallback data" },
};

export const DEMO_FIXTURE_CLAIM_EVENTS: TokenClaimEvent[] = [
  {
    tokenMint: DEMO_FIXTURE_TOKEN_MINT,
    claimerWallet: "AliceWallet1111111111111111111111111111111111",
    amountLamports: BigInt(12_500_000_000),
    txSignature: "DemoTxAlice" + "1".repeat(77),
    claimedAt: new Date("2026-04-20T12:00:00Z"),
  },
  {
    tokenMint: DEMO_FIXTURE_TOKEN_MINT,
    claimerWallet: "BobWallet11111111111111111111111111111111111",
    amountLamports: BigInt(8_750_000_000),
    txSignature: "DemoTxBob11" + "1".repeat(77),
    claimedAt: new Date("2026-04-22T14:30:00Z"),
  },
  {
    tokenMint: DEMO_FIXTURE_TOKEN_MINT,
    claimerWallet: "CarolWallet111111111111111111111111111111111",
    amountLamports: BigInt(4_200_000_000),
    txSignature: "DemoTxCarol" + "1".repeat(77),
    claimedAt: new Date("2026-04-24T09:15:00Z"),
  },
];

export const DEMO_FIXTURE_PARTNER_CONFIGS: Record<string, PartnerConfig> = {
  AliceWallet1111111111111111111111111111111111: {
    partnerWallet: "AliceWallet1111111111111111111111111111111111",
    partnerConfigPda: "AlicePDA111111111111111111111111111111111111",
    feeBps: 100,
    isActive: true,
    createdAt: new Date("2026-04-01T00:00:00Z"),
  },
  BobWallet11111111111111111111111111111111111: {
    partnerWallet: "BobWallet11111111111111111111111111111111111",
    partnerConfigPda: "BobPDA1111111111111111111111111111111111111",
    feeBps: 150,
    isActive: true,
    createdAt: new Date("2026-04-03T00:00:00Z"),
  },
  CarolWallet111111111111111111111111111111111: {
    partnerWallet: "CarolWallet111111111111111111111111111111111",
    partnerConfigPda: "CarolPDA11111111111111111111111111111111111",
    feeBps: 75,
    isActive: true,
    createdAt: new Date("2026-04-05T00:00:00Z"),
  },
};

export const DEMO_FIXTURE_PARTNER_STATS: Record<string, PartnerClaimStats> = {
  AliceWallet1111111111111111111111111111111111: {
    partnerWallet: "AliceWallet1111111111111111111111111111111111",
    partnerConfigPda: "AlicePDA111111111111111111111111111111111111",
    claimedFeesLamports: BigInt(12_500_000_000),
    unclaimedFeesLamports: BigInt(3_200_000_000),
    lastClaimedAt: new Date("2026-04-25T08:00:00Z"),
    raw: { source: "fixture" },
  },
  BobWallet11111111111111111111111111111111111: {
    partnerWallet: "BobWallet11111111111111111111111111111111111",
    partnerConfigPda: "BobPDA1111111111111111111111111111111111111",
    claimedFeesLamports: BigInt(8_750_000_000),
    unclaimedFeesLamports: BigInt(1_500_000_000),
    lastClaimedAt: new Date("2026-04-24T10:00:00Z"),
    raw: { source: "fixture" },
  },
  CarolWallet111111111111111111111111111111111: {
    partnerWallet: "CarolWallet111111111111111111111111111111111",
    partnerConfigPda: "CarolPDA11111111111111111111111111111111111",
    claimedFeesLamports: BigInt(4_200_000_000),
    unclaimedFeesLamports: BigInt(900_000_000),
    lastClaimedAt: new Date("2026-04-23T15:00:00Z"),
    raw: { source: "fixture" },
  },
};

/** Fallback PartnerClaimStats for unknown wallets */
export function makeEmptyPartnerStats(partnerWallet: string): PartnerClaimStats {
  return {
    partnerWallet,
    partnerConfigPda: null,
    claimedFeesLamports: BigInt(0),
    unclaimedFeesLamports: BigInt(0),
    lastClaimedAt: null,
    raw: { source: "fixture", note: "no partner config found" },
  };
}
