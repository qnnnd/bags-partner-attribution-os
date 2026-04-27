import {
  RiskType,
  RiskSeverity,
  REPEATED_CLICK_THRESHOLD,
  REPEATED_CLICK_WINDOW_MINUTES,
  TINY_BUY_THRESHOLD_LAMPORTS,
  ABNORMAL_CONVERSION_RATIO_THRESHOLD,
  BURST_WALLET_THRESHOLD,
  SCORE_MODIFIERS,
} from "@bags/shared";
import type { RiskFlag, RiskInput } from "./types";

/**
 * Rule: self_buy — affiliate wallet is the same as the buyer wallet.
 * Highest-severity flag; always applied when condition is met.
 */
export function checkSelfBuy(input: RiskInput): RiskFlag | null {
  if (
    input.buyerWallet &&
    input.buyerWallet === input.affiliateWallet
  ) {
    return {
      riskType: RiskType.SelfBuy,
      severity: RiskSeverity.High,
      scoreDelta: SCORE_MODIFIERS.SELF_BUY,
      reason: `Buyer wallet matches affiliate wallet (${input.affiliateWallet}). Likely self-referral.`,
    };
  }
  return null;
}

/**
 * Rule: repeated_click — same IP+UA combination clicked more than the threshold
 * within the configured window.
 */
export function checkRepeatedClick(input: RiskInput): RiskFlag | null {
  if (
    input.sameIpUaClickCount >= REPEATED_CLICK_THRESHOLD &&
    input.sameIpUaWindowMinutes <= REPEATED_CLICK_WINDOW_MINUTES
  ) {
    return {
      riskType: RiskType.RepeatedClick,
      severity: RiskSeverity.Medium,
      scoreDelta: SCORE_MODIFIERS.REPEATED_CLICK,
      reason: `Same IP hash and user agent triggered ${input.sameIpUaClickCount} visits in ${input.sameIpUaWindowMinutes} minutes (threshold: ${REPEATED_CLICK_THRESHOLD} in ${REPEATED_CLICK_WINDOW_MINUTES} min).`,
    };
  }
  return null;
}

/**
 * Rule: tiny_buy — attributed volume is suspiciously small.
 */
export function checkTinyBuy(input: RiskInput): RiskFlag | null {
  if (
    input.attributedVolumeLamports != null &&
    input.attributedVolumeLamports > BigInt(0) &&
    input.attributedVolumeLamports < BigInt(TINY_BUY_THRESHOLD_LAMPORTS)
  ) {
    return {
      riskType: RiskType.TinyBuy,
      severity: RiskSeverity.Medium,
      scoreDelta: SCORE_MODIFIERS.TINY_BUY,
      reason: `Attributed volume ${input.attributedVolumeLamports} lamports is below the minimum threshold of ${TINY_BUY_THRESHOLD_LAMPORTS} lamports.`,
    };
  }
  return null;
}

/**
 * Rule: abnormal_conversion — buy intent count is disproportionately high
 * relative to click count, suggesting manufactured intent signals.
 */
export function checkAbnormalConversion(input: RiskInput): RiskFlag | null {
  if (input.clickCount === 0) return null;

  const ratio = input.buyIntentCount / input.clickCount;
  if (ratio > ABNORMAL_CONVERSION_RATIO_THRESHOLD && input.buyIntentCount > 5) {
    return {
      riskType: RiskType.AbnormalConversion,
      severity: RiskSeverity.Medium,
      scoreDelta: SCORE_MODIFIERS.ABNORMAL_CONVERSION,
      reason: `Buy intent / click ratio is ${(ratio * 100).toFixed(1)}% (threshold: ${ABNORMAL_CONVERSION_RATIO_THRESHOLD * 100}%). Possible manufactured intent signals.`,
    };
  }
  return null;
}

/**
 * Rule: burst_activity — multiple distinct wallets triggered events for this
 * affiliate's ref within a short burst window.
 * medium risk at threshold; high risk at 2× threshold.
 */
export function checkBurstActivity(input: RiskInput): RiskFlag | null {
  if (input.burstWalletCount < BURST_WALLET_THRESHOLD) return null;

  const isHigh = input.burstWalletCount >= BURST_WALLET_THRESHOLD * 2;
  return {
    riskType: RiskType.BurstActivity,
    severity: isHigh ? RiskSeverity.High : RiskSeverity.Medium,
    scoreDelta: isHigh ? SCORE_MODIFIERS.SELF_BUY : SCORE_MODIFIERS.REPEATED_CLICK,
    reason: `${input.burstWalletCount} distinct wallets triggered events within ${input.burstWindowMinutes} minutes (threshold: ${BURST_WALLET_THRESHOLD}).`,
  };
}

/**
 * Rule: missing_wallet — affiliate has click events but no wallet_connect.
 * Low severity: signals the attribution cannot reach WalletIntent level.
 */
export function checkMissingWallet(input: RiskInput): RiskFlag | null {
  if (!input.hasMissingWallet) return null;
  return {
    riskType: RiskType.NewWallet,
    severity: RiskSeverity.Low,
    scoreDelta: 0,
    reason: "Affiliate has click events but no wallet connection recorded. Attribution limited to Click level.",
  };
}

export const ALL_RULES = [
  checkSelfBuy,
  checkRepeatedClick,
  checkTinyBuy,
  checkAbnormalConversion,
  checkBurstActivity,
  checkMissingWallet,
] as const;
