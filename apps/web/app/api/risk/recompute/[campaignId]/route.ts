/**
 * POST /api/risk/recompute/:campaignId
 *
 * Triggers a full attribution + risk recompute for a campaign.
 * Returns a summary of the results.
 */
import { NextResponse } from "next/server";
import { recomputeAttribution } from "../../../../../lib/attribution-aggregator";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { campaignId } = await params;

  try {
    const entries = await recomputeAttribution(campaignId);

    const summary = {
      totalAffiliates: entries.length,
      highRisk: entries.filter((e) => e.riskLevel === "high").length,
      mediumRisk: entries.filter((e) => e.riskLevel === "medium").length,
      suspicious: entries.filter((e) => e.status === "suspicious").length,
      onchainCandidates: entries.filter((e) => e.solscanLink != null).length,
    };

    return NextResponse.json({
      campaignId,
      summary,
      entries: entries.map((e) => ({
        affiliateId: e.affiliateId,
        displayName: e.displayName,
        confidenceScore: e.confidenceScore,
        attributionType: e.attributionType,
        status: e.status,
        riskLevel: e.riskLevel,
        solscanLink: e.solscanLink ?? null,
        reason: e.reason ?? null,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
