import type { RiskSeverity, RiskType } from "@bags/shared";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface RiskInput {
  campaignId: string;
  affiliateId: string;
  affiliateWallet: string;
  buyerWallet?: string;
  /** Number of clicks in the evaluation window */
  clickCount: number;
  /** Number of buy intents in the evaluation window */
  buyIntentCount: number;
  /** Number of distinct wallet events in the evaluation window */
  walletEventCount: number;
  /** Attributed volume in lamports (if known) */
  attributedVolumeLamports?: bigint;
  /** IP hash (already anonymised) */
  ipHash?: string;
  /** User-agent hash (already anonymised) */
  userAgentHash?: string;
  /** How many clicks came from this same IP+UA combination */
  sameIpUaClickCount: number;
  /** Time window in minutes used for the sameIpUaClickCount */
  sameIpUaWindowMinutes: number;
}

// ─── Output ───────────────────────────────────────────────────────────────────

export interface RiskFlag {
  riskType: RiskType;
  severity: RiskSeverity;
  scoreDelta: number;
  reason: string;
}

export interface RiskOutput {
  campaignId: string;
  affiliateId: string;
  riskLevel: RiskSeverity | null;
  riskScore: number;
  isHighRisk: boolean;
  flags: RiskFlag[];
}
