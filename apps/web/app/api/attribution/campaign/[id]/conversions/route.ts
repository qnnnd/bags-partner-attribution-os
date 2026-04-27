/**
 * GET /api/attribution/campaign/:id/conversions
 *
 * Returns all attribution_conversion records for a campaign,
 * with their associated risk flags.
 */
import { prisma } from "@bags/db";
import { ok, notFound } from "../../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!campaign) return notFound("Campaign not found");

  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: {
      riskFlags: true,
      affiliate: { select: { displayName: true, refCode: true, walletAddress: true } },
    },
  });

  const serialized = conversions.map((c) => ({
    id: c.id,
    affiliateId: c.affiliateId,
    displayName: c.affiliate.displayName,
    refCode: c.affiliate.refCode,
    walletAddress: c.affiliate.walletAddress,
    buyerWallet: c.buyerWallet,
    tokenMint: c.tokenMint,
    txSignature: c.txSignature,
    attributionType: c.attributionType,
    confidenceScore: c.confidenceScore,
    attributedVolumeLamports: c.attributedVolumeLamports?.toString() ?? null,
    status: c.status,
    reason: c.reason,
    createdAt: c.createdAt.toISOString(),
    riskFlags: c.riskFlags.map((f) => ({
      type: f.riskType,
      severity: f.severity,
      scoreDelta: f.scoreDelta,
      reason: f.reason,
    })),
  }));

  return ok({ campaignId: id, conversions: serialized });
}
