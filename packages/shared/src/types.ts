// ─── User ─────────────────────────────────────────────────────────────────────

export enum UserRole {
  Creator = "creator",
  Affiliate = "affiliate",
  Admin = "admin",
}

// ─── Campaign ─────────────────────────────────────────────────────────────────

export enum CampaignStatus {
  Draft = "draft",
  Active = "active",
  Paused = "paused",
  Archived = "archived",
}

// ─── Affiliate ────────────────────────────────────────────────────────────────

export enum AffiliateStatus {
  Invited = "invited",
  Active = "active",
  Paused = "paused",
}

// ─── Tracking ─────────────────────────────────────────────────────────────────

export enum TrackingEventType {
  Visit = "visit",
  Share = "share",
  WalletConnect = "wallet_connect",
  BuyClick = "buy_click",
  OutboundToBags = "outbound_to_bags",
}

// ─── Attribution ──────────────────────────────────────────────────────────────

export enum AttributionType {
  Click = "click",
  WalletIntent = "wallet_intent",
  OnchainCandidate = "onchain_candidate",
  Confirmed = "confirmed",
}

export enum ConversionStatus {
  Candidate = "candidate",
  Confirmed = "confirmed",
  Suspicious = "suspicious",
  Rejected = "rejected",
}

// ─── Risk ─────────────────────────────────────────────────────────────────────

export enum RiskType {
  SelfBuy = "self_buy",
  RepeatedClick = "repeated_click",
  TinyBuy = "tiny_buy",
  AbnormalConversion = "abnormal_conversion",
  NewWallet = "new_wallet",
  BurstActivity = "burst_activity",
  MultiWalletPattern = "multi_wallet_pattern",
}

export enum RiskSeverity {
  Low = "low",
  Medium = "medium",
  High = "high",
}

// ─── Payout ───────────────────────────────────────────────────────────────────

export enum PayoutStatus {
  PendingReview = "pending_review",
  Approved = "approved",
  TxCreated = "tx_created",
  Paid = "paid",
  Rejected = "rejected",
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  affiliateId: string;
  displayName: string;
  walletAddress: string;
  refCode: string;
  clicks: number;
  walletConnects: number;
  buyIntents: number;
  attributedConversions: number;
  confidenceScore: number;
  attributionType: AttributionType;
  claimedFeesLamports: bigint | number;
  unclaimedFeesLamports: bigint | number;
  status: ConversionStatus;
  riskLevel: RiskSeverity | null;
}
