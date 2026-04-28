/**
 * GET /api/reports/campaign/:id/payout.csv
 *
 * Exports a payout report CSV with per-affiliate attribution, fee, and ledger data.
 *
 * Phase 3: suspicious conversions have suggested_payout_sol = "0".
 * Phase 4: adds payout_id, payout_status, approved_amount_sol, payout_tx_signature
 *          from PayoutLedger rows. Rejected payouts show approved_amount_sol = "0".
 *
 * CSV columns:
 *   rank, affiliate_display_name, affiliate_wallet, ref_code,
 *   partner_config_pda, clicks, wallet_connects, buy_intents,
 *   confidence_score, attribution_type, status,
 *   claimed_fees_sol, unclaimed_fees_sol, attributed_volume_sol,
 *   risk_level, risk_flags, snapshot_at,
 *   suggested_payout_sol, suggested_payout_note, solscan_link,
 *   payout_id, payout_status, approved_amount_sol, payout_tx_signature
 */
import { prisma } from "@bags/db";
import { buildCsv, lamportsToSolStr } from "../../../../../../lib/csv";
import { notFound } from "../../../../../../lib/api-response";
import { NextResponse } from "next/server";
import { solscanTxLink } from "@bags/bags-client";

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

  // Phase 4: latest payout ledger row per affiliate
  const payoutRows = await prisma.payoutLedger.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
  });
  const payoutMap = new Map<string, typeof payoutRows[0]>();
  for (const p of payoutRows) {
    if (!payoutMap.has(p.affiliateId)) payoutMap.set(p.affiliateId, p);
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
    "suggested_payout_sol",
    "suggested_payout_note",
    "solscan_link",
    // Phase 4 columns
    "payout_id",
    "payout_status",
    "approved_amount_sol",
    "payout_tx_signature",
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
    const hasValidConversion = !!conv && !isSuspicious;

    // Only affiliates with a valid (non-suspicious) last-touch conversion get suggested payout
    const suggestedPayoutSol =
      !hasValidConversion ? "0" : lamportsToSolStr(fee?.unclaimedFeesLamports ?? BigInt(0));
    const suggestedPayoutNote = isSuspicious
      ? "FLAGGED - suspicious conversion"
      : !conv
        ? "no_valid_attribution"
        : "eligible";
    const solscanLink = conv?.txSignature ? solscanTxLink(conv.txSignature) : "";

    // Phase 4: payout ledger data
    const payout = payoutMap.get(aff.id);
    const payoutId = payout?.id ?? "";
    const payoutStatus = payout?.status ?? "";
    // rejected payouts show 0 in approved_amount_sol
    const approvedAmountSol =
      payout?.status === "rejected"
        ? "0"
        : payout?.approvedAmountLamports != null
          ? lamportsToSolStr(payout.approvedAmountLamports)
          : "";
    const payoutTxSignature = payout?.txSignature ?? "";

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
      suggestedPayoutSol,
      suggestedPayoutNote,
      solscanLink,
      payoutId,
      payoutStatus,
      approvedAmountSol,
      payoutTxSignature,
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
