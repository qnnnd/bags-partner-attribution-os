/**
 * Attribution Aggregator — Phase 2
 *
 * Merges on-chain Bags fee data (from partner_fee_snapshots)
 * with local tracking events to produce enriched leaderboard entries
 * and attribution_conversions.
 */
import { prisma } from "@bags/db";
import { computeAttribution } from "@bags/attribution-engine";
import { evaluateRisk } from "@bags/risk-engine";
import type { AttributionInput, TrackingSignal } from "@bags/attribution-engine";
import type { RiskInput } from "@bags/risk-engine";
import type { LeaderboardEntry } from "@bags/shared";
import { AttributionType, ConversionStatus, RiskSeverity } from "@bags/shared";

export interface AggregatedLeaderboardEntry extends LeaderboardEntry {
  partnerConfigPda: string | null;
  feeBps: number | null;
  riskFlags: Array<{ type: string; severity: string; reason: string }>;
  latestSnapshotAt: string | null;
}

/**
 * Full attribution recompute for a campaign.
 */
export async function recomputeAttribution(
  campaignId: string,
): Promise<AggregatedLeaderboardEntry[]> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { affiliates: { where: { status: "active" } } },
  });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const affiliates = campaign.affiliates;

  // Build event count map per affiliate
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

  // Latest partner fee snapshot per affiliate
  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  const entries: AggregatedLeaderboardEntry[] = [];

  for (const aff of affiliates) {
    const counts = eventMap.get(aff.id) ?? {};
    const clicks = counts["visit"] ?? 0;
    const walletConnects = counts["wallet_connect"] ?? 0;
    const buyIntents = (counts["buy_click"] ?? 0) + (counts["outbound_to_bags"] ?? 0);
    const feeSnap = feeMap.get(aff.id);

    // Build TrackingSignal for attribution engine
    const signal: TrackingSignal = {
      sessionId: `agg-${aff.id}`,
      affiliateId: aff.id,
      refCode: aff.refCode,
      walletAddress: walletConnects > 0 ? aff.walletAddress : undefined,
      hasWalletConnect: walletConnects > 0,
      hasBuyClick: buyIntents > 0,
      hasOnchainCandidate: false,
      visitCount: clicks,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    };

    const attributionInput: AttributionInput = {
      campaignId,
      affiliateId: aff.id,
      affiliateWallet: aff.walletAddress,
      buyerWallet: undefined,
      tokenMint: campaign.tokenMint,
      attributionWindowMinutes: campaign.attributionWindowMinutes,
      signals: clicks > 0 || walletConnects > 0 || buyIntents > 0 ? [signal] : [],
    };

    const attributionResult = computeAttribution(attributionInput);

    // Risk evaluation
    const riskInput: RiskInput = {
      campaignId,
      affiliateId: aff.id,
      affiliateWallet: aff.walletAddress,
      buyerWallet: undefined,
      clickCount: clicks,
      buyIntentCount: buyIntents,
      walletEventCount: walletConnects,
      attributedVolumeLamports: feeSnap
        ? feeSnap.claimedFeesLamports + feeSnap.unclaimedFeesLamports
        : BigInt(0),
      sameIpUaClickCount: 0,
      sameIpUaWindowMinutes: 10,
    };
    const riskResult = evaluateRisk(riskInput);

    const totalRiskDelta = riskResult.flags.reduce((s, f) => s + f.scoreDelta, 0);
    const finalScore = Math.max(0, attributionResult.confidenceScore - totalRiskDelta);

    const status: ConversionStatus =
      riskResult.riskLevel === "high"
        ? ConversionStatus.Suspicious
        : finalScore >= 80
          ? ConversionStatus.Confirmed
          : ConversionStatus.Candidate;

    const attributedVolume = feeSnap
      ? feeSnap.claimedFeesLamports + feeSnap.unclaimedFeesLamports
      : BigInt(0);

    // Upsert attribution_conversion
    const existingConversion = await prisma.attributionConversion.findFirst({
      where: { campaignId, affiliateId: aff.id },
      orderBy: { createdAt: "desc" },
    });

    if (existingConversion) {
      await prisma.attributionConversion.update({
        where: { id: existingConversion.id },
        data: {
          attributionType: attributionResult.attributionType as never,
          confidenceScore: finalScore,
          status: status as never,
          reason: attributionResult.reason,
          attributedVolumeLamports: attributedVolume,
        },
      });
    } else if (buyIntents > 0 || walletConnects > 0) {
      await prisma.attributionConversion.create({
        data: {
          campaignId,
          affiliateId: aff.id,
          buyerWallet: null,
          tokenMint: campaign.tokenMint,
          txSignature: null,
          attributionType: attributionResult.attributionType as never,
          confidenceScore: finalScore,
          attributedVolumeLamports: attributedVolume,
          status: status as never,
          reason: attributionResult.reason,
        },
      });
    }

    // Save risk flags
    if (riskResult.flags.length > 0) {
      await prisma.riskFlag.createMany({
        data: riskResult.flags.map((f) => ({
          campaignId,
          affiliateId: aff.id,
          riskType: f.riskType as never,
          severity: f.severity as never,
          scoreDelta: f.scoreDelta,
          reason: f.reason,
        })),
        skipDuplicates: true,
      });
    }

    entries.push({
      rank: 0,
      affiliateId: aff.id,
      displayName: aff.displayName,
      walletAddress: aff.walletAddress,
      refCode: aff.refCode,
      clicks,
      walletConnects,
      buyIntents,
      attributedConversions: buyIntents > 0 ? 1 : 0,
      confidenceScore: finalScore,
      attributionType: attributionResult.attributionType as AttributionType,
      claimedFeesLamports: feeSnap ? Number(feeSnap.claimedFeesLamports) : 0,
      unclaimedFeesLamports: feeSnap ? Number(feeSnap.unclaimedFeesLamports) : 0,
      status,
      riskLevel: (riskResult.riskLevel as RiskSeverity) ?? null,
      partnerConfigPda: aff.partnerConfigPda ?? null,
      feeBps: null,
      riskFlags: riskResult.flags.map((f) => ({
        type: f.riskType,
        severity: f.severity,
        reason: f.reason,
      })),
      latestSnapshotAt: feeSnap?.snapshotAt.toISOString() ?? null,
    });
  }

  entries.sort((a, b) => b.confidenceScore - a.confidenceScore);
  entries.forEach((e, i) => { e.rank = i + 1; });

  return entries;
}

export async function getCampaignTokenStats(campaignId: string) {
  const snap = await prisma.tokenFeeSnapshot.findFirst({
    where: { campaignId },
    orderBy: { snapshotAt: "desc" },
  });
  return snap
    ? {
        lifetimeFeesLamports: snap.lifetimeFeesLamports?.toString() ?? "0",
        snapshotAt: snap.snapshotAt.toISOString(),
      }
    : null;
}
