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

// ─── On-chain Buy Candidate ───────────────────────────────────────────────────

/**
 * Represents a candidate on-chain buy transaction found for a buyer wallet
 * within the attribution window. This is NOT proof of attribution — it means
 * the wallet transacted with the target token mint during the window.
 */
export interface OnchainBuyCandidate {
  txSignature: string;
  walletAddress: string;
  tokenMint: string;
  /** Block timestamp of the transaction */
  timestamp: Date;
  /** Read-only Solscan explorer link */
  solscanLink: string;
}

// ─── BagsClient Interface ─────────────────────────────────────────────────────

export interface BagsClient {
  getTokenLifetimeFees(tokenMint: string): Promise<TokenFeeStats>;
  getTokenClaimEvents(tokenMint: string): Promise<TokenClaimEvent[]>;
  getPartnerConfig(partnerWallet: string): Promise<PartnerConfig | null>;
  getPartnerClaimStats(partnerWallet: string): Promise<PartnerClaimStats>;
  /**
   * Query a wallet's token activity on-chain (read-only).
   * Returns candidates where the wallet transacted with the given token mint
   * on or after `since`. Used for Phase 3 on-chain candidate detection.
   * Never sends a transaction.
   */
  getWalletTokenActivity(
    walletAddress: string,
    tokenMint: string,
    since: Date,
  ): Promise<OnchainBuyCandidate[]>;
  // Optional write methods (Phase 5 only)
  createPartnerKeyTx?(partnerWallet: string): Promise<string>;
  getPartnerClaimTxs?(partnerWallet: string): Promise<string[]>;
}

export type BagsClientMode = "mock" | "mainnet-readonly";
