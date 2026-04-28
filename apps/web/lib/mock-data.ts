import {
  AttributionType,
  ConversionStatus,
  RiskSeverity,
} from "@bags/shared";
import type { LeaderboardEntry } from "@bags/shared";

export const MOCK_CAMPAIGN = {
  id: "demo-campaign-001",
  name: "BAGS Genesis Launch",
  slug: "bags-genesis",
  tokenMint: "MockToken11111111111111111111111111111111111",
  bagsTokenUrl: "https://bags.fm/token/MockToken111",
  status: "active" as const,
  attributionWindowMinutes: 1440,
  creatorWallet: "CreatorWallet11111111111111111111111111111111",
  createdAt: new Date("2026-04-01T00:00:00Z"),
  stats: {
    totalClicks: 1_284,
    walletConnects: 387,
    buyIntents: 214,
    attributedConversions: 42,
    lifetimeFeesLamports: 250_000_000_000,
  },
};

export const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  {
    rank: 1,
    affiliateId: "aff-alice-001",
    displayName: "Alice.sol",
    walletAddress: "AliceWallet1111111111111111111111111111111111",
    refCode: "ALICE42",
    clicks: 612,
    walletConnects: 189,
    buyIntents: 103,
    attributedConversions: 22,
    confidenceScore: 90,
    attributionType: AttributionType.OnchainCandidate,
    claimedFeesLamports: 12_500_000_000,
    unclaimedFeesLamports: 3_200_000_000,
    status: ConversionStatus.Confirmed,
    riskLevel: null,
    isLastTouch: true,
  },
  {
    rank: 2,
    affiliateId: "aff-bob-001",
    displayName: "Bob.sol",
    walletAddress: "BobWallet11111111111111111111111111111111111",
    refCode: "BOB99",
    clicks: 428,
    walletConnects: 134,
    buyIntents: 76,
    attributedConversions: 14,
    confidenceScore: 75,
    attributionType: AttributionType.WalletIntent,
    claimedFeesLamports: 8_750_000_000,
    unclaimedFeesLamports: 1_500_000_000,
    status: ConversionStatus.Candidate,
    riskLevel: null,
    isLastTouch: true,
  },
  {
    rank: 3,
    affiliateId: "aff-carol-001",
    displayName: "Carol.sol",
    walletAddress: "CarolWallet111111111111111111111111111111111",
    refCode: "CAROL7",
    clicks: 244,
    walletConnects: 64,
    buyIntents: 35,
    attributedConversions: 6,
    confidenceScore: 45,
    attributionType: AttributionType.Click,
    claimedFeesLamports: 4_200_000_000,
    unclaimedFeesLamports: 900_000_000,
    status: ConversionStatus.Candidate,
    riskLevel: RiskSeverity.Low,
    isLastTouch: true,
  },
];

export function lamportsToSol(lamports: number | bigint): string {
  const n = typeof lamports === "bigint" ? Number(lamports) : lamports;
  return (n / 1e9).toFixed(3);
}

export function confidenceLabel(score: number): {
  label: string;
  color: string;
} {
  if (score >= 80) return { label: "High", color: "text-green-400" };
  if (score >= 50) return { label: "Medium", color: "text-yellow-400" };
  return { label: "Low", color: "text-gray-400" };
}
