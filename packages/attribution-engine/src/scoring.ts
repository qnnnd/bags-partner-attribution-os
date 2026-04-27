import {
  AttributionType,
  ConversionStatus,
  SCORE_MODIFIERS,
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  REPEATED_CLICK_THRESHOLD,
  REPEATED_CLICK_WINDOW_MINUTES,
} from "@bags/shared";
import type { AttributionInput, AttributionResult, ScoreBreakdown } from "./types";

/**
 * Computes the attribution score for a single affiliate-campaign pair using
 * the MVP scoring formula from §9.2 of the technical plan.
 *
 * Score modifiers:
 *  +20  valid ref link visit
 *  +20  no repeated click anomaly
 *  +25  wallet connected
 *  +20  buy click recorded
 *  +25  on-chain buy candidate detected in attribution window
 *  -30  self-buy (affiliate wallet == buyer wallet)
 *  -20  repeated click anomaly detected
 */
export function computeScore(input: AttributionInput): {
  score: number;
  breakdown: ScoreBreakdown;
  attributionType: AttributionType;
} {
  const { signals, buyerWallet, affiliateWallet } = input;

  if (signals.length === 0) {
    return {
      score: 0,
      breakdown: {
        base: 0,
        validRefLink: 0,
        noRepeatedClicks: 0,
        walletConnect: 0,
        buyClick: 0,
        onchainCandidate: 0,
        selfBuyPenalty: 0,
        repeatedClickPenalty: 0,
        total: 0,
      },
      attributionType: AttributionType.Click,
    };
  }

  // Use the most recent (last-touch) signal
  const lastSignal = signals[signals.length - 1]!;

  const hasValidRefLink = lastSignal.visitCount > 0;
  const hasRepeatedClicks = detectRepeatedClicks(signals);
  const hasWalletConnect = signals.some((s) => s.hasWalletConnect);
  const hasBuyClick = signals.some((s) => s.hasBuyClick);
  const hasOnchainCandidate = input.onchainBuyAt != null || signals.some((s) => s.hasOnchainCandidate);
  const isSelfBuy = buyerWallet != null && buyerWallet === affiliateWallet;

  const validRefLink = hasValidRefLink ? SCORE_MODIFIERS.VALID_REF_LINK : 0;
  const noRepeatedClicks = !hasRepeatedClicks ? SCORE_MODIFIERS.NO_REPEATED_CLICKS : 0;
  const walletConnect = hasWalletConnect ? SCORE_MODIFIERS.WALLET_CONNECT : 0;
  const buyClick = hasBuyClick ? SCORE_MODIFIERS.BUY_CLICK : 0;
  const onchainCandidate = hasOnchainCandidate ? SCORE_MODIFIERS.ONCHAIN_CANDIDATE : 0;
  const selfBuyPenalty = isSelfBuy ? SCORE_MODIFIERS.SELF_BUY : 0;
  const repeatedClickPenalty = hasRepeatedClicks ? SCORE_MODIFIERS.REPEATED_CLICK : 0;

  const total = Math.max(
    0,
    validRefLink +
      noRepeatedClicks +
      walletConnect +
      buyClick +
      onchainCandidate +
      selfBuyPenalty +
      repeatedClickPenalty,
  );

  const breakdown: ScoreBreakdown = {
    base: 0,
    validRefLink,
    noRepeatedClicks,
    walletConnect,
    buyClick,
    onchainCandidate,
    selfBuyPenalty,
    repeatedClickPenalty,
    total,
  };

  let attributionType: AttributionType = AttributionType.Click;
  if (hasOnchainCandidate) {
    attributionType = AttributionType.OnchainCandidate;
  } else if (hasBuyClick || hasWalletConnect) {
    attributionType = AttributionType.WalletIntent;
  }

  return { score: total, breakdown, attributionType };
}

/**
 * Checks if any signal shows repeated clicks within the time window threshold.
 */
function detectRepeatedClicks(signals: AttributionInput["signals"]): boolean {
  for (const signal of signals) {
    if (signal.visitCount >= REPEATED_CLICK_THRESHOLD) {
      const windowMs = REPEATED_CLICK_WINDOW_MINUTES * 60 * 1000;
      const elapsed =
        signal.lastSeenAt.getTime() - signal.firstSeenAt.getTime();
      if (elapsed <= windowMs) return true;
    }
  }
  return false;
}

/**
 * Determines the attribution status based on the confidence score and risk flags.
 */
export function resolveStatus(
  score: number,
  isSelfBuy: boolean,
  hasHighRisk: boolean,
): ConversionStatus {
  if (isSelfBuy || hasHighRisk) return ConversionStatus.Suspicious;
  if (score >= CONFIDENCE_HIGH) return ConversionStatus.Confirmed;
  if (score >= CONFIDENCE_MEDIUM) return ConversionStatus.Candidate;
  return ConversionStatus.Candidate;
}

/**
 * Builds a human-readable reason string for the attribution result.
 */
export function buildReason(
  score: number,
  breakdown: ScoreBreakdown,
  attributionType: AttributionType,
): string {
  const parts: string[] = [];
  if (breakdown.validRefLink > 0) parts.push("ref link visit");
  if (breakdown.walletConnect > 0) parts.push("wallet connected");
  if (breakdown.buyClick > 0) parts.push("buy click recorded");
  if (breakdown.onchainCandidate > 0) parts.push("on-chain candidate detected");
  if (breakdown.selfBuyPenalty < 0) parts.push("self-buy penalty applied");
  if (breakdown.repeatedClickPenalty < 0) parts.push("repeated-click penalty applied");

  return `${attributionType} attribution (score: ${score}): ${parts.join(", ") || "no signals"}`;
}

/**
 * Applies last-touch dedup: given multiple AttributionResults for the same
 * buyer wallet / session, keeps only the one with the most recent signal.
 * All others have isLastTouch = false.
 */
export function applyLastTouch(results: AttributionResult[]): AttributionResult[] {
  if (results.length <= 1) {
    return results.map((r) => ({ ...r, isLastTouch: true }));
  }

  // Group by buyer wallet
  const byWallet = new Map<string, AttributionResult[]>();
  for (const r of results) {
    const key = r.buyerWallet ?? `no-wallet-${r.affiliateId}`;
    const existing = byWallet.get(key) ?? [];
    existing.push(r);
    byWallet.set(key, existing);
  }

  const out: AttributionResult[] = [];
  for (const group of byWallet.values()) {
    // Sort descending by confidence; highest-confidence gets last-touch
    const sorted = [...group].sort(
      (a, b) => b.confidenceScore - a.confidenceScore,
    );
    out.push({ ...sorted[0]!, isLastTouch: true });
    for (const r of sorted.slice(1)) {
      out.push({ ...r, isLastTouch: false });
    }
  }
  return out;
}
