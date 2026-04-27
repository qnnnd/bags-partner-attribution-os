/**
 * GET /api/reports/campaign/:id/payout.csv
 *
 * Exports a payout report CSV with per-affiliate attribution + fee data.
 * Suspicious conversions are flagged but NOT excluded from the report
 * (creator must review manually).
 *
 * CSV columns:
 *   rank, affiliate_display_name, affiliate_wallet, ref_code,
 *   partner_config_pda, clicks, wallet_connects, buy_intents,
 *   confidence_score, attribution_type, status,
 *   claimed_fees_sol, unclaimed_fees_sol, attributed_volume_sol,
 *   risk_level, risk_flags, snapshot_at, suggested_payout_sol
 */
import { prisma } from "@bags/db";
import { buildCsv, lamportsToSolStr } from "../../../../../../lib/csv";
import { notFound } from "../../../../../../lib/api-response";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { name: true, tokenMint: true },
  });
  if (!campaign) return notFound("Campaign not found");

  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  // Latest partner fee snapshots
  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  // Attribution conversions
  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });
  const convMap = new Map<string, typeof conversions[0]>();
  for (const c of conversions) {
    if (!convMap.has(c.affiliateId)) convMap.set(c.affiliateId, c);
  }

  // Tracking event counts
  const eventRows = await prisma.trackingEvent.groupBy({
    by: ["affiliateId", "eventType"],
    where: { campaignId, affiliateId: { not: null } },
    _count: { _all: true },
  });
  const eventMap = new Map<string, Record<string, number>>();
  for (const row of eventRows) {
    if (!row.affiliateId) continue;
    const e = eventMap.get(row.affiliateId) ?? {};
    e[row.eventType] = row._count._all;
    eventMap.set(row.affiliateId, e);
  }

  // Risk flags per affiliate
  const riskRows = await prisma.riskFlag.findMany({
    where: { campaignId, affiliateId: { not: null } },
  });
  const riskMap = new Map<string, string[]>();
  for (const r of riskRows) {
    if (!r.affiliateId) continue;
    const arr = riskMap.get(r.affiliateId) ?? [];
    arr.push(`${r.riskType}(${r.severity})`);
    riskMap.set(r.affiliateId, arr);
  }

  const HEADERS = [
    "rank",
    "affiliate_display_name",
    "affiliate_wallet",
    "ref_code",
    "partner_config_pda",
    "clicks",
    "wallet_connects",
    "buy_intents",
    "confidence_score",
    "attribution_type",
    "status",
    "claimed_fees_sol",
    "unclaimed_fees_sol",
    "attributed_volume_sol",
    "risk_level",
    "risk_flags",
    "snapshot_at",
    "suggested_payout_note",
  ];

  const rows = affiliates.map((aff, idx) => {
    const counts = eventMap.get(aff.id) ?? {};
    const clicks = counts["visit"] ?? 0;
    const wc = counts["wallet_connect"] ?? 0;
    const bi = (counts["buy_click"] ?? 0) + (counts["outbound_to_bags"] ?? 0);
    const fee = feeMap.get(aff.id);
    const conv = convMap.get(aff.id);
    const riskFlags = (riskMap.get(aff.id) ?? []).join("; ");
    const isSuspicious = conv?.status === "suspicious";

    return [
      idx + 1,
      aff.displayName,
      aff.walletAddress,
      aff.refCode,
      aff.partnerConfigPda ?? "",
      clicks,
      wc,
      bi,
      conv?.confidenceScore ?? 0,
      conv?.attributionType ?? "click",
      conv?.status ?? "candidate",
      lamportsToSolStr(fee?.claimedFeesLamports ?? BigInt(0)),
      lamportsToSolStr(fee?.unclaimedFeesLamports ?? BigInt(0)),
      lamportsToSolStr(conv?.attributedVolumeLamports ?? null),
      isSuspicious ? "high" : riskFlags ? "medium" : "low",
      riskFlags,
      fee?.snapshotAt.toISOString() ?? "",
      isSuspicious ? "FLAGGED - creator review required" : "eligible",
    ];
  });

  const csv = buildCsv(HEADERS, rows);
  const filename = `payout-report-${campaign.name.replace(/[^a-z0-9]/gi, "-")}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
