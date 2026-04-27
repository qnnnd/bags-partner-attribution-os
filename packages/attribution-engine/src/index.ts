export * from "./types";
export { computeScore, resolveStatus, buildReason, applyLastTouch } from "./scoring";

import { buildReason, computeScore, resolveStatus } from "./scoring";
import type { AttributionInput, AttributionResult } from "./types";

/**
 * Computes a single attribution result for one affiliate + campaign combination.
 */
export function computeAttribution(
  input: AttributionInput,
  options: { hasHighRisk?: boolean } = {},
): AttributionResult {
  const { score, breakdown, attributionType } = computeScore(input);
  const isSelfBuy =
    input.buyerWallet != null &&
    input.buyerWallet === input.affiliateWallet;

  const status = resolveStatus(score, isSelfBuy, options.hasHighRisk ?? false);
  const reason = buildReason(score, breakdown, attributionType);

  const lastSignal = input.signals.length > 0 ? input.signals[input.signals.length - 1] : null;

  return {
    campaignId: input.campaignId,
    affiliateId: input.affiliateId,
    buyerWallet: input.buyerWallet,
    tokenMint: input.tokenMint,
    attributionType,
    confidenceScore: score,
    scoreBreakdown: breakdown,
    status,
    reason,
    isLastTouch: true,
    lastSignalAt: lastSignal?.lastSeenAt,
  };
}
