/**
 * POST /api/attribution/recompute/:campaignId
 *
 * Re-runs the full attribution + risk engine for a campaign.
 * Merges tracking events with latest Bags partner fee snapshots.
 * Updates attribution_conversions and risk_flags tables.
 */
import { prisma } from "@bags/db";
import { getSession } from "../../../../../lib/session";
import { recomputeAttribution } from "../../../../../lib/attribution-aggregator";
import { ok, unauthorized, forbidden, notFound, serverError } from "../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { campaignId } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return notFound("Campaign not found");
    if (campaign.creatorWallet !== session.walletAddress) return forbidden();

    const entries = await recomputeAttribution(campaignId);

    return ok({
      campaignId,
      recomputed: entries.length,
      entries,
      recomputedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[POST /api/attribution/recompute/:campaignId]", e);
    return serverError(e instanceof Error ? e.message : "Recompute failed");
  }
}
