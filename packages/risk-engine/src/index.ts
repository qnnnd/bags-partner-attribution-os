export * from "./types";
export * from "./rules";

import { RiskSeverity } from "@bags/shared";
import { ALL_RULES } from "./rules";
import type { RiskInput, RiskOutput } from "./types";

/**
 * Evaluates all MVP risk rules against a single attribution candidate.
 * Returns a RiskOutput with all triggered flags and an aggregate risk level.
 */
export function evaluateRisk(input: RiskInput): RiskOutput {
  const flags = ALL_RULES.map((rule) => rule(input)).filter(
    (f): f is NonNullable<typeof f> => f !== null,
  );

  const totalDelta = flags.reduce((sum, f) => sum + f.scoreDelta, 0);
  const riskScore = Math.abs(totalDelta);

  const hasHigh = flags.some((f) => f.severity === RiskSeverity.High);
  const hasMedium = flags.some((f) => f.severity === RiskSeverity.Medium);

  let riskLevel: RiskSeverity | null = null;
  if (hasHigh) riskLevel = RiskSeverity.High;
  else if (hasMedium) riskLevel = RiskSeverity.Medium;
  else if (flags.length > 0) riskLevel = RiskSeverity.Low;

  return {
    campaignId: input.campaignId,
    affiliateId: input.affiliateId,
    riskLevel,
    riskScore,
    isHighRisk: hasHigh,
    flags,
  };
}
