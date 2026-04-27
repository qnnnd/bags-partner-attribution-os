/**
 * GET /api/risk/campaign/:id
 *
 * Returns all risk flags for a campaign, grouped by affiliate.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id: campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, name: true },
  });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const flags = await prisma.riskFlag.findMany({
    where: { campaignId },
    orderBy: { createdAt: "desc" },
    include: {
      affiliate: {
        select: { displayName: true, walletAddress: true, refCode: true },
      },
    },
  });

  // Suspicious conversions
  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId, status: "suspicious" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      affiliateId: true,
      buyerWallet: true,
      confidenceScore: true,
      reason: true,
      txSignature: true,
      attributionType: true,
    },
  });

  const summary = {
    totalFlags: flags.length,
    highRiskCount: flags.filter((f) => f.severity === "high").length,
    mediumRiskCount: flags.filter((f) => f.severity === "medium").length,
    lowRiskCount: flags.filter((f) => f.severity === "low").length,
    suspiciousConversions: conversions.length,
  };

  return NextResponse.json({
    campaignId,
    campaignName: campaign.name,
    summary,
    flags: flags.map((f) => ({
      id: f.id,
      affiliateId: f.affiliateId,
      affiliateDisplayName: f.affiliate?.displayName ?? null,
      affiliateRefCode: f.affiliate?.refCode ?? null,
      conversionId: f.conversionId,
      riskType: f.riskType,
      severity: f.severity,
      scoreDelta: f.scoreDelta,
      reason: f.reason,
      createdAt: f.createdAt.toISOString(),
    })),
    suspiciousConversions: conversions.map((c) => ({
      id: c.id,
      affiliateId: c.affiliateId,
      buyerWallet: c.buyerWallet,
      confidenceScore: c.confidenceScore,
      reason: c.reason,
      txSignature: c.txSignature,
      attributionType: c.attributionType,
    })),
  });
}
