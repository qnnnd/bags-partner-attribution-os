// ─── Token Fee Stats ──────────────────────────────────────────────────────────

export interface TokenFeeStats {
  tokenMint: string;
  lifetimeFeesLamports: bigint;
  lastUpdatedAt: Date;
  raw?: Record<string, unknown>;
}

// ─── Token Claim Event ────────────────────────────────────────────────────────

export interface TokenClaimEvent {
  tokenMint: string;
  claimerWallet: string;
  amountLamports: bigint;
  txSignature: string;
  claimedAt: Date;
}

// ─── Partner Config ───────────────────────────────────────────────────────────

export interface PartnerConfig {
  partnerWallet: string;
  partnerConfigPda: string;
  feeBps: number;
  isActive: boolean;
  createdAt: Date;
}

// ─── Partner Claim Stats ──────────────────────────────────────────────────────

export interface PartnerClaimStats {
  partnerWallet: string;
  partnerConfigPda: string | null;
  claimedFeesLamports: bigint;
  unclaimedFeesLamports: bigint;
  lastClaimedAt: Date | null;
  raw?: Record<string, unknown>;
}

// ─── BagsClient Interface ─────────────────────────────────────────────────────

export interface BagsClient {
  getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats>;
  getTokenClaimEvents(tokenMint: string): Promise<TokenClaimEvent[]>;
  getPartnerConfig(partnerWallet: string): Promise<PartnerConfig | null>;
  getPartnerClaimStats(partnerWallet: string): Promise<PartnerClaimStats>;
  // Optional write methods (Phase 5 only)
  createPartnerKeyTx?(partnerWallet: string): Promise<string>;
  getPartnerClaimTxs?(partnerWallet: string): Promise<string[]>;
}

export type BagsClientMode = "mock" | "mainnet-readonly";
