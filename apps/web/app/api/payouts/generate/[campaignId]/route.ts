/**
 * POST /api/payouts/generate/:campaignId
 *
 * Generates (or refreshes) suggested payout ledger entries for a campaign.
 *
 * Rules:
 *   - Only affiliates with a valid non-suspicious attributionConversion are eligible
 *   - Non-last-touch affiliates have no conversion after recompute and are excluded
 *   - suggestedAmountLamports = unclaimedFeesLamports from the latest fee snapshot
 *   - Pending rows for no-longer-eligible affiliates are deleted
 *   - Rows in approved / tx_created / paid / rejected states are NOT modified
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { requireCreatorSession, requireCampaignCreator } from "../../../../../lib/api-auth";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { campaignId } = await params;

  const { walletAddress, authError: sessionErr } = await requireCreatorSession();
  if (sessionErr) return sessionErr;

  const { authError: campaignErr } = await requireCampaignCreator(campaignId, walletAddress!);
  if (campaignErr) return campaignErr;

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

  const validConversions = await prisma.attributionConversion.findMany({
    where: { campaignId, status: { not: "suspicious" } },
    select: { affiliateId: true },
  });
  const eligibleIds = new Set(validConversions.map((c) => c.affiliateId));

  const suspiciousConversions = await prisma.attributionConversion.findMany({
    where: { campaignId, status: "suspicious" },
    select: { affiliateId: true },
  });
  const suspiciousIds = new Set(suspiciousConversions.map((c) => c.affiliateId));

  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  const existingPending = await prisma.payoutLedger.findMany({
    where: { campaignId, status: "pending_review" },
    select: { id: true, affiliateId: true },
  });
  const pendingMap = new Map(existingPending.map((p) => [p.affiliateId, p.id]));

  const generated: string[] = [];
  const skippedSuspicious: string[] = [];
  const skippedNoConversion: string[] = [];
  const skippedLocked: string[] = [];
  const removedPending: string[] = [];

  for (const aff of affiliates) {
    const existingPendingId = pendingMap.get(aff.id);

    if (suspiciousIds.has(aff.id)) {
      skippedSuspicious.push(aff.id);
      if (existingPendingId) {
        await prisma.payoutLedger.delete({ where: { id: existingPendingId } });
        removedPending.push(aff.id);
      }
      continue;
    }

    if (!eligibleIds.has(aff.id)) {
      skippedNoConversion.push(aff.id);
      if (existingPendingId) {
        await prisma.payoutLedger.delete({ where: { id: existingPendingId } });
        removedPending.push(aff.id);
      }
      continue;
    }

    const fee = feeMap.get(aff.id);
    const suggestedAmountLamports = fee ? fee.unclaimedFeesLamports : BigInt(0);

    if (existingPendingId) {
      await prisma.payoutLedger.update({
        where: { id: existingPendingId },
        data: { suggestedAmountLamports },
      });
      generated.push(aff.id);
    } else {
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
    skippedNoConversion: skippedNoConversion.length,
    skippedLocked: skippedLocked.length,
    removedPending: removedPending.length,
    message: `Generated/refreshed ${generated.length} payout ledger entries. Skipped: ${skippedSuspicious.length} suspicious, ${skippedNoConversion.length} without valid attribution, ${skippedLocked.length} locked. Removed ${removedPending.length} stale pending entries.`,
  });
}
