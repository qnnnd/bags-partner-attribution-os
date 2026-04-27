import { MOCK_TOKEN_MINT } from "@bags/shared";
import type {
  BagsClient,
  PartnerClaimStats,
  PartnerConfig,
  TokenClaimEvent,
  TokenFeeStats,
} from "./types";

// Deterministic fixture wallets for the 3 mock affiliates
const MOCK_AFFILIATES = [
  {
    wallet: "AliceWallet1111111111111111111111111111111111",
    pda: "AlicePDA111111111111111111111111111111111111",
    claimedLamports: BigInt(12_500_000_000), // 12.5 SOL
    unclaimedLamports: BigInt(3_200_000_000), // 3.2 SOL
  },
  {
    wallet: "BobWallet11111111111111111111111111111111111",
    pda: "BobPDA1111111111111111111111111111111111111",
    claimedLamports: BigInt(8_750_000_000), // 8.75 SOL
    unclaimedLamports: BigInt(1_500_000_000), // 1.5 SOL
  },
  {
    wallet: "CarolWallet111111111111111111111111111111111",
    pda: "CarolPDA11111111111111111111111111111111111",
    claimedLamports: BigInt(4_200_000_000), // 4.2 SOL
    unclaimedLamports: BigInt(900_000_000), // 0.9 SOL
  },
];

export class MockBagsClient implements BagsClient {
  async getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats> {
    return {
      tokenMint,
      lifetimeFeesLamports: BigInt(250_000_000_000), // 250 SOL
      lastUpdatedAt: new Date("2026-04-27T00:00:00Z"),
      raw: {
        source: "mock",
        tokenMint,
        lifetimeFees: "250000000000",
      },
    };
  }

  async getTokenClaimEvents(tokenMint: string): Promise<TokenClaimEvent[]> {
    return MOCK_AFFILIATES.map((a, i) => ({
      tokenMint,
      claimerWallet: a.wallet,
      amountLamports: a.claimedLamports,
      txSignature: `MockTxSig${i + 1}${"1".repeat(80 - 10 - String(i + 1).length)}`,
      claimedAt: new Date(`2026-04-${20 + i}T12:00:00Z`),
    }));
  }

  async getPartnerConfig(partnerWallet: string): Promise<PartnerConfig | null> {
    const found = MOCK_AFFILIATES.find((a) => a.wallet === partnerWallet);
    if (!found) return null;
    return {
      partnerWallet,
      partnerConfigPda: found.pda,
      feeBps: 100, // 1%
      isActive: true,
      createdAt: new Date("2026-04-01T00:00:00Z"),
    };
  }

  async getPartnerClaimStats(
    partnerWallet: string,
  ): Promise<PartnerClaimStats> {
    const found = MOCK_AFFILIATES.find((a) => a.wallet === partnerWallet);
    if (!found) {
      return {
        partnerWallet,
        partnerConfigPda: null,
        claimedFeesLamports: BigInt(0),
        unclaimedFeesLamports: BigInt(0),
        lastClaimedAt: null,
        raw: { source: "mock", note: "no partner config found" },
      };
    }
    return {
      partnerWallet,
      partnerConfigPda: found.pda,
      claimedFeesLamports: found.claimedLamports,
      unclaimedFeesLamports: found.unclaimedLamports,
      lastClaimedAt: new Date("2026-04-25T08:00:00Z"),
      raw: {
        source: "mock",
        partnerWallet,
        claimedFees: found.claimedLamports.toString(),
        unclaimedFees: found.unclaimedLamports.toString(),
      },
    };
  }
}

export const MOCK_AFFILIATE_FIXTURES = MOCK_AFFILIATES;
export { MOCK_TOKEN_MINT };
