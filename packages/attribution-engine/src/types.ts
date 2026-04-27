import type { AttributionType, ConversionStatus } from "@bags/shared";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface TrackingSignal {
  sessionId: string;
  affiliateId: string;
  refCode: string;
  walletAddress?: string;
  hasWalletConnect: boolean;
  hasBuyClick: boolean;
  hasOnchainCandidate: boolean;
  visitCount: number;
  ipHash?: string;
  userAgentHash?: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface AttributionInput {
  campaignId: string;
  affiliateId: string;
  buyerWallet?: string;
  affiliateWallet: string;
  tokenMint: string;
  attributionWindowMinutes: number;
  signals: TrackingSignal[];
  /** Timestamp of the on-chain buy candidate, if detected */
  onchainBuyAt?: Date;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface ScoreBreakdown {
  base: number;
  validRefLink: number;
  noRepeatedClicks: number;
  walletConnect: number;
  buyClick: number;
  onchainCandidate: number;
  selfBuyPenalty: number;
  repeatedClickPenalty: number;
  total: number;
}

export interface AttributionResult {
  campaignId: string;
  affiliateId: string;
  buyerWallet?: string;
  tokenMint: string;
  attributionType: AttributionType;
  confidenceScore: number;
  scoreBreakdown: ScoreBreakdown;
  status: ConversionStatus;
  reason: string;
  isLastTouch: boolean;
  /** Timestamp of the most recent signal — used for time-based last-touch dedup */
  lastSignalAt?: Date;
}
