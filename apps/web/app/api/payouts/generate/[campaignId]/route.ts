/**
 * POST /api/payouts/generate/:campaignId
 *
 * Generates (or refreshes) suggested payout ledger entries for a campaign.
 *
 * Rules:
 *   - Only active affiliates are included
 *   - Affiliates with a suspicious conversion are EXCLUDED
 *   - suggestedAmountLamports = unclaimedFeesLamports from the latest fee snapshot
 *   - Affiliates with no fee snapshot get suggestedAmountLamports = 0
 *   - Idempotent: upserts by (campaignId, affiliateId) — existing pending_review rows are refreshed
 *   - Rows in approved / tx_created / paid / rejected states are NOT modified
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  // Suspicious affiliate IDs — never generate payout for these
  const suspiciousConversions = await prisma.attributionConversion.findMany({
    where: { campaignId, status: "suspicious" },
    select: { affiliateId: true },
  });
  const suspiciousIds = new Set(suspiciousConversions.map((c) => c.affiliateId));

  // Latest fee snapshot per affiliate
  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  // Existing pending_review ledger rows (only those can be refreshed)
  const existingPending = await prisma.payoutLedger.findMany({
    where: { campaignId, status: "pending_review" },
    select: { id: true, affiliateId: true },
  });
  const pendingMap = new Map(existingPending.map((p) => [p.affiliateId, p.id]));

  const generated: string[] = [];
  const skippedSuspicious: string[] = [];
  const skippedLocked: string[] = [];

  for (const aff of affiliates) {
    if (suspiciousIds.has(aff.id)) {
      skippedSuspicious.push(aff.id);
      continue;
    }

    const fee = feeMap.get(aff.id);
    const suggestedAmountLamports = fee ? fee.unclaimedFeesLamports : BigInt(0);

    const existingId = pendingMap.get(aff.id);

    if (existingId) {
      // Refresh existing pending row
      await prisma.payoutLedger.update({
        where: { id: existingId },
        data: { suggestedAmountLamports },
      });
      generated.push(aff.id);
    } else {
      // Check if a non-pending row already exists — do not overwrite
      const locked = await prisma.payoutLedger.findFirst({
        where: {
          campaignId,
          affiliateId: aff.id,
          status: { not: "pending_review" },
        },
        select: { id: true, status: true },
      });
      if (locked) {
        skippedLocked.push(aff.id);
        continue;
      }
      // Create new pending_review row
      await prisma.payoutLedger.create({
        data: {
          campaignId,
          affiliateId: aff.id,
          currency: "SOL",
          suggestedAmountLamports,
          status: "pending_review",
        },
      });
      generated.push(aff.id);
    }
  }

  return NextResponse.json({
    campaignId,
    generated: generated.length,
    skippedSuspicious: skippedSuspicious.length,
    skippedLocked: skippedLocked.length,
    message: `Generated/refreshed ${generated.length} payout ledger entries.`,
  });
}
