import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { AttributionType, ConversionStatus } from "@bags/shared";
import { MOCK_LEADERBOARD, MOCK_CAMPAIGN } from "../../../../../../lib/mock-data";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Fall back to mock data for the Phase 0 demo campaign
  if (id === MOCK_CAMPAIGN.id || id === MOCK_CAMPAIGN.slug) {
    const serialized = MOCK_LEADERBOARD.map((entry) => ({
      ...entry,
      claimedFeesLamports: String(entry.claimedFeesLamports),
      unclaimedFeesLamports: String(entry.unclaimedFeesLamports),
    }));
    return NextResponse.json({
      campaignId: id,
      model: "last_touch",
      mode: "mock",
      entries: serialized,
      generatedAt: new Date().toISOString(),
    });
  }

  // Real DB aggregation for Phase 1+ campaigns
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, tokenMint: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId: id, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  // Aggregate tracking events per affiliate
  const trackingCounts = await prisma.trackingEvent.groupBy({
    by: ["affiliateId", "eventType"],
    where: { campaignId: id, affiliateId: { not: null } },
    _count: { _all: true },
  });

  // Build lookup map
  const countMap = new Map<string, Record<string, number>>();
  for (const row of trackingCounts) {
    if (!row.affiliateId) continue;
    const existing = countMap.get(row.affiliateId) ?? {};
    existing[row.eventType] = row._count._all;
    countMap.set(row.affiliateId, existing);
  }

  // Fetch latest partner fee snapshot per affiliate
  const feeSnapshots = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId: id, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(
    feeSnapshots.map((s) => [s.affiliateId, s]),
  );

  // Fetch latest attribution conversion per affiliate
  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    distinct: ["affiliateId"],
  });
  const conversionMap = new Map(conversions.map((c) => [c.affiliateId, c]));

  const entries = affiliates.map((aff, idx) => {
    const counts = countMap.get(aff.id) ?? {};
    const clicks = counts["visit"] ?? 0;
    const walletConnects = counts["wallet_connect"] ?? 0;
    const buyIntents = (counts["buy_click"] ?? 0) + (counts["outbound_to_bags"] ?? 0);
    const conv = conversionMap.get(aff.id);
    const fee = feeMap.get(aff.id ?? "");

    const confidenceScore = conv?.confidenceScore ?? (walletConnects > 0 ? 45 : clicks > 0 ? 20 : 0);
    const attributionType = conv?.attributionType ?? (walletConnects > 0 ? "wallet_intent" : "click");
    const status = conv?.status ?? "candidate";

    return {
      rank: idx + 1,
      affiliateId: aff.id,
      displayName: aff.displayName,
      walletAddress: aff.walletAddress,
      refCode: aff.refCode,
      clicks,
      walletConnects,
      buyIntents,
      attributedConversions: conv ? 1 : 0,
      confidenceScore,
      attributionType: attributionType as AttributionType,
      claimedFeesLamports: fee ? fee.claimedFeesLamports.toString() : "0",
      unclaimedFeesLamports: fee ? fee.unclaimedFeesLamports.toString() : "0",
      status: status as ConversionStatus,
      riskLevel: null,
    };
  });

  // Sort by confidence score descending, reassign ranks
  entries.sort((a, b) => b.confidenceScore - a.confidenceScore);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return NextResponse.json({
    campaignId: id,
    model: "last_touch",
    mode: "live",
    entries,
    generatedAt: new Date().toISOString(),
  });
}
