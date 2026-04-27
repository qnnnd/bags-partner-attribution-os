/**
 * GET /api/reports/campaign/:id/summary
 *
 * Returns a JSON summary for the campaign report page:
 * total tracking events, affiliate stats, token fees, attribution summary.
 */
import { prisma } from "@bags/db";
import { ok, notFound } from "../../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true, tokenMint: true, status: true, createdAt: true },
  });
  if (!campaign) return notFound("Campaign not found");

  const [eventCounts, affiliateCount, conversionRows, tokenFeeSnap, partnerFeeSnaps] =
    await Promise.all([
      prisma.trackingEvent.groupBy({
        by: ["eventType"],
        where: { campaignId },
        _count: { _all: true },
      }),
      prisma.affiliate.count({ where: { campaignId, status: "active" } }),
      prisma.attributionConversion.findMany({
        where: { campaignId },
        select: { status: true, confidenceScore: true, attributedVolumeLamports: true },
      }),
      prisma.tokenFeeSnapshot.findFirst({
        where: { campaignId },
        orderBy: { snapshotAt: "desc" },
      }),
      prisma.partnerFeeSnapshot.findMany({
        where: { campaignId, affiliateId: { not: null } },
        orderBy: { snapshotAt: "desc" },
        distinct: ["affiliateId"],
      }),
    ]);

  const cm = Object.fromEntries(eventCounts.map((e) => [e.eventType, e._count._all]));
  const totalClicks = cm["visit"] ?? 0;
  const totalWalletConnects = cm["wallet_connect"] ?? 0;
  const totalBuyIntents = (cm["buy_click"] ?? 0) + (cm["outbound_to_bags"] ?? 0);

  const totalClaimedLamports = partnerFeeSnaps.reduce(
    (s, snap) => s + snap.claimedFeesLamports,
    BigInt(0),
  );
  const totalUnclaimedLamports = partnerFeeSnaps.reduce(
    (s, snap) => s + snap.unclaimedFeesLamports,
    BigInt(0),
  );

  const highConf = conversionRows.filter((c) => c.confidenceScore >= 80).length;
  const medConf = conversionRows.filter((c) => c.confidenceScore >= 50 && c.confidenceScore < 80).length;
  const suspicious = conversionRows.filter((c) => c.status === "suspicious").length;

  return ok({
    campaignId,
    name: campaign.name,
    tokenMint: campaign.tokenMint,
    status: campaign.status,
    generatedAt: new Date().toISOString(),
    tracking: {
      totalClicks,
      totalWalletConnects,
      totalBuyIntents,
    },
    affiliates: { active: affiliateCount },
    attribution: {
      total: conversionRows.length,
      highConfidence: highConf,
      mediumConfidence: medConf,
      suspicious,
    },
    fees: {
      lifetimeTokenFeesLamports: tokenFeeSnap?.lifetimeFeesLamports?.toString() ?? null,
      totalPartnerClaimedLamports: totalClaimedLamports.toString(),
      totalPartnerUnclaimedLamports: totalUnclaimedLamports.toString(),
      lastSyncedAt: tokenFeeSnap?.snapshotAt.toISOString() ?? null,
    },
  });
}
