/**
 * GET /api/payouts/:payoutId
 *
 * Returns a single payout ledger entry with affiliate info.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { lamportsToSolStr } from "../../../../lib/csv";
import { solscanTxLink } from "@bags/bags-client";
import { requireCreatorSession, requireCampaignCreator } from "../../../../lib/api-auth";

interface RouteParams {
  params: Promise<{ payoutId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { payoutId } = await params;

  const { walletAddress, authError: sessionErr } = await requireCreatorSession();
  if (sessionErr) return sessionErr;

  const ledger = await prisma.payoutLedger.findUnique({
    where: { id: payoutId },
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
  if (!ledger) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  const { authError: campaignErr } = await requireCampaignCreator(ledger.campaignId, walletAddress!);
  if (campaignErr) return campaignErr;

  return NextResponse.json({
    id: ledger.id,
    campaignId: ledger.campaignId,
    affiliateId: ledger.affiliateId,
    affiliateDisplayName: ledger.affiliate.displayName,
    affiliateWallet: ledger.affiliate.walletAddress,
    affiliateRefCode: ledger.affiliate.refCode,
    partnerConfigPda: ledger.affiliate.partnerConfigPda ?? null,
    currency: ledger.currency,
    suggestedAmountLamports: ledger.suggestedAmountLamports.toString(),
    suggestedAmountSol: lamportsToSolStr(ledger.suggestedAmountLamports),
    approvedAmountLamports: ledger.approvedAmountLamports?.toString() ?? null,
    approvedAmountSol: ledger.approvedAmountLamports
      ? lamportsToSolStr(ledger.approvedAmountLamports)
      : null,
    status: ledger.status,
    txSignature: ledger.txSignature ?? null,
    solscanLink: ledger.txSignature ? solscanTxLink(ledger.txSignature) : null,
    createdAt: ledger.createdAt.toISOString(),
    updatedAt: ledger.updatedAt.toISOString(),
  });
}
