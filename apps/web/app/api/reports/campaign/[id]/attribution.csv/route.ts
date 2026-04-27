/**
 * GET /api/reports/campaign/:id/attribution.csv
 *
 * Exports per-event attribution details for auditing.
 *
 * CSV columns:
 *   event_id, event_type, session_id, ref_code, affiliate_display_name,
 *   affiliate_wallet, wallet_address, ip_hash, user_agent_hash, created_at
 */
import { prisma } from "@bags/db";
import { buildCsv } from "../../../../../../lib/csv";
import { notFound } from "../../../../../../lib/api-response";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true },
  });
  if (!campaign) return notFound("Campaign not found");

  const events = await prisma.trackingEvent.findMany({
    where: { campaignId },
    orderBy: { createdAt: "asc" },
    include: {
      campaign: { select: { name: true } },
    },
  });

  // Affiliate name lookup
  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId },
    select: { id: true, displayName: true, walletAddress: true },
  });
  const affMap = new Map(affiliates.map((a) => [a.id, a]));

  const HEADERS = [
    "event_id",
    "event_type",
    "session_id",
    "ref_code",
    "affiliate_display_name",
    "affiliate_wallet",
    "buyer_wallet_address",
    "ip_hash",
    "user_agent_hash",
    "created_at",
  ];

  const rows = events.map((e) => {
    const aff = e.affiliateId ? affMap.get(e.affiliateId) : null;
    return [
      e.id,
      e.eventType,
      e.sessionId,
      e.refCode ?? "",
      aff?.displayName ?? "",
      aff?.walletAddress ?? "",
      e.walletAddress ?? "",
      e.ipHash ?? "",
      e.userAgentHash ?? "",
      e.createdAt.toISOString(),
    ];
  });

  const csv = buildCsv(HEADERS, rows);
  const filename = `attribution-events-${campaign.name.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
