/**
 * GET /api/payouts/campaign/:campaignId
 *
 * Returns all payout ledger entries for a campaign with affiliate info,
 * sorted by suggested amount descending.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { lamportsToSolStr } from "../../../../../lib/csv";
import { solscanTxLink } from "@bags/bags-client";
import { requireCreatorSession, requireCampaignCreator } from "../../../../../lib/api-auth";

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
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

  const ledgers = await prisma.payoutLedger.findMany({
    where: { campaignId },
    orderBy: { suggestedAmountLamports: "desc" },
    include: {
      affiliate: {
        select: {
          displayName: true,
          walletAddress: true,
          refCode: true,
          partnerConfigPda: true,
        },
      },
    },
  });

  // Latest conversion per affiliate for risk level
  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    select: { affiliateId: true, status: true, confidenceScore: true },
  });
  const convMap = new Map<string, typeof conversions[0]>();
  for (const c of conversions) {
    if (!convMap.has(c.affiliateId)) convMap.set(c.affiliateId, c);
  }

  // Latest risk level per affiliate
  const riskFlags = await prisma.riskFlag.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { affiliateId: true, severity: true },
  });
  const riskMap = new Map<string, string>();
  for (const r of riskFlags) {
    if (!r.affiliateId) continue;
    if (!riskMap.has(r.affiliateId)) riskMap.set(r.affiliateId, r.severity);
  }

  const summary = {
    total: ledgers.length,
    pendingReview: ledgers.filter((l) => l.status === "pending_review").length,
    approved: ledgers.filter((l) => l.status === "approved").length,
    txCreated: ledgers.filter((l) => l.status === "tx_created").length,
    paid: ledgers.filter((l) => l.status === "paid").length,
    rejected: ledgers.filter((l) => l.status === "rejected").length,
    totalSuggestedSol: lamportsToSolStr(
      ledgers.reduce((s, l) => s + l.suggestedAmountLamports, BigInt(0)),
    ),
    totalApprovedSol: lamportsToSolStr(
      ledgers.reduce((s, l) => s + (l.approvedAmountLamports ?? BigInt(0)), BigInt(0)),
    ),
  };

  return NextResponse.json({
    campaignId,
    campaignName: campaign.name,
    summary,
    ledgers: ledgers.map((l) => {
      const conv = convMap.get(l.affiliateId);
      return {
        id: l.id,
        affiliateId: l.affiliateId,
        affiliateDisplayName: l.affiliate.displayName,
        affiliateWallet: l.affiliate.walletAddress,
        affiliateRefCode: l.affiliate.refCode,
        partnerConfigPda: l.affiliate.partnerConfigPda ?? null,
        currency: l.currency,
        suggestedAmountLamports: l.suggestedAmountLamports.toString(),
        suggestedAmountSol: lamportsToSolStr(l.suggestedAmountLamports),
        approvedAmountLamports: l.approvedAmountLamports?.toString() ?? null,
        approvedAmountSol: l.approvedAmountLamports
          ? lamportsToSolStr(l.approvedAmountLamports)
          : null,
        status: l.status,
        txSignature: l.txSignature ?? null,
        solscanLink: l.txSignature ? solscanTxLink(l.txSignature) : null,
        riskLevel: riskMap.get(l.affiliateId) ?? null,
        conversionStatus: conv?.status ?? null,
        createdAt: l.createdAt.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      };
    }),
  });
}
