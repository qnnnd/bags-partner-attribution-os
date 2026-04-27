/**
 * Attribution Aggregator — Phase 3
 *
 * Phase 2: Merges on-chain Bags fee data with local tracking events.
 * Phase 3 additions:
 *   - Attribution window enforcement (filter events by createdAt)
 *   - On-chain buy candidate detection via BagsClient.getWalletTokenActivity
 *   - tx_signature + solscanLink saved to AttributionConversion
 *   - burst_activity (distinct wallets) and missing_wallet risk inputs
 *   - sameIpUaClickCount computed from real IP+UA hash data
 *   - Stale risk flags cleared before recompute to prevent accumulation
 */
import { prisma } from "@bags/db";
import { computeAttribution } from "@bags/attribution-engine";
import { evaluateRisk } from "@bags/risk-engine";
import type { AttributionInput, TrackingSignal } from "@bags/attribution-engine";
import type { RiskInput } from "@bags/risk-engine";
import type { LeaderboardEntry } from "@bags/shared";
import {
  AttributionType,
  ConversionStatus,
  RiskSeverity,
  BURST_WINDOW_MINUTES,
  REPEATED_CLICK_WINDOW_MINUTES,
} from "@bags/shared";
import { createBagsClient } from "@bags/bags-client";

export interface AggregatedLeaderboardEntry extends LeaderboardEntry {
  partnerConfigPda: string | null;
  feeBps: number | null;
  riskFlags: Array<{ type: string; severity: string; reason: string }>;
  latestSnapshotAt: string | null;
}

/**
 * Full attribution recompute for a campaign.
 * Enforces attribution window, detects on-chain buy candidates, evaluates risk.
 *
 * Clears stale risk flags before writing new ones to prevent accumulation.
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
  const windowMinutes = campaign.attributionWindowMinutes;
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  // ── Fix 7: Clear stale risk flags before recomputing to prevent accumulation ─
  await prisma.riskFlag.deleteMany({ where: { campaignId } });

  const bagsClient = createBagsClient();

  // ── Event aggregation (within attribution window) ──────────────────────────
  const eventRows = await prisma.trackingEvent.groupBy({
    by: ["affiliateId", "eventType"],
    where: {
      campaignId,
      affiliateId: { not: null },
      createdAt: { gte: windowStart },
    },
    _count: { _all: true },
  });
  const eventMap = new Map<string, Record<string, number>>();
  for (const row of eventRows) {
    if (!row.affiliateId) continue;
    const e = eventMap.get(row.affiliateId) ?? {};
    e[row.eventType] = row._count._all;
    eventMap.set(row.affiliateId, e);
  }

  // ── Latest partner fee snapshot per affiliate ──────────────────────────────
  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  // ── Fix 4: Burst-activity — count DISTINCT wallets per affiliate in burst window ──
  const burstWindowStart = new Date(Date.now() - BURST_WINDOW_MINUTES * 60 * 1000);
  const burstEvents = await prisma.trackingEvent.findMany({
    where: {
      campaignId,
      affiliateId: { not: null },
      walletAddress: { not: null },
      createdAt: { gte: burstWindowStart },
    },
    select: { affiliateId: true, walletAddress: true },
  });
  const burstWalletSets = new Map<string, Set<string>>();
  for (const ev of burstEvents) {
    if (!ev.affiliateId || !ev.walletAddress) continue;
    const wallets = burstWalletSets.get(ev.affiliateId) ?? new Set<string>();
    wallets.add(ev.walletAddress);
    burstWalletSets.set(ev.affiliateId, wallets);
  }

  // ── Fix 3: sameIpUaClickCount — max visits from one IP+UA pair per affiliate ──
  const ipUaWindowStart = new Date(Date.now() - REPEATED_CLICK_WINDOW_MINUTES * 60 * 1000);
  const ipUaEvents = await prisma.trackingEvent.findMany({
    where: {
      campaignId,
      affiliateId: { not: null },
      eventType: "visit",
      ipHash: { not: null },
      userAgentHash: { not: null },
      createdAt: { gte: ipUaWindowStart },
    },
    select: { affiliateId: true, ipHash: true, userAgentHash: true },
  });
  const ipUaCountPerKey = new Map<string, number>(); // "affiliateId:ipHash:uaHash" → count
  const sameIpUaMap = new Map<string, number>();      // affiliateId → max count
  for (const ev of ipUaEvents) {
    if (!ev.affiliateId || !ev.ipHash || !ev.userAgentHash) continue;
    const key = `${ev.affiliateId}:${ev.ipHash}:${ev.userAgentHash}`;
    const count = (ipUaCountPerKey.get(key) ?? 0) + 1;
    ipUaCountPerKey.set(key, count);
    const cur = sameIpUaMap.get(ev.affiliateId) ?? 0;
    if (count > cur) sameIpUaMap.set(ev.affiliateId, count);
  }

  // ── Build buyer wallet map: affiliate → most recent connected wallet ───────
  const walletRows = await prisma.trackingEvent.findMany({
    where: {
      campaignId,
      affiliateId: { not: null },
      eventType: "wallet_connect",
      walletAddress: { not: null },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "desc" },
    select: { affiliateId: true, walletAddress: true },
  });
  const buyerWalletMap = new Map<string, string>();
  for (const row of walletRows) {
    if (!row.affiliateId || !row.walletAddress) continue;
    if (!buyerWalletMap.has(row.affiliateId)) {
      buyerWalletMap.set(row.affiliateId, row.walletAddress);
    }
  }

  const entries: AggregatedLeaderboardEntry[] = [];

  for (const aff of affiliates) {
    const counts = eventMap.get(aff.id) ?? {};
    const clicks = counts["visit"] ?? 0;
    const walletConnects = counts["wallet_connect"] ?? 0;
    const buyIntents = (counts["buy_click"] ?? 0) + (counts["outbound_to_bags"] ?? 0);
    const feeSnap = feeMap.get(aff.id);
    const buyerWallet = buyerWalletMap.get(aff.id);
    const burstWalletCount = burstWalletSets.get(aff.id)?.size ?? 0;
    const sameIpUaClickCount = sameIpUaMap.get(aff.id) ?? 0;

    // ── On-chain candidate detection ────────────────────────────────────────
    let onchainTxSignature: string | undefined;
    let onchainBuyAt: Date | undefined;
    let solscanLink: string | undefined;

    if (buyerWallet && (walletConnects > 0 || buyIntents > 0)) {
      try {
        const candidates = await bagsClient.getWalletTokenActivity(
          buyerWallet,
          campaign.tokenMint,
          windowStart,
        );
        if (candidates.length > 0) {
          const best = candidates.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0]!;
          onchainTxSignature = best.txSignature;
          onchainBuyAt = best.timestamp;
          solscanLink = best.solscanLink;
        }
      } catch {
        // Non-fatal: proceed without on-chain candidate
      }
    }

    // ── Attribution scoring ──────────────────────────────────────────────────
    const signal: TrackingSignal = {
      sessionId: `agg-${aff.id}`,
      affiliateId: aff.id,
      refCode: aff.refCode,
      walletAddress: buyerWallet,
      hasWalletConnect: walletConnects > 0,
      hasBuyClick: buyIntents > 0,
      hasOnchainCandidate: onchainTxSignature != null,
      visitCount: clicks,
      firstSeenAt: windowStart,
      lastSeenAt: new Date(),
    };

    const attributionInput: AttributionInput = {
      campaignId,
      affiliateId: aff.id,
      affiliateWallet: aff.walletAddress,
      buyerWallet,
      tokenMint: campaign.tokenMint,
      attributionWindowMinutes: windowMinutes,
      signals: clicks > 0 || walletConnects > 0 || buyIntents > 0 ? [signal] : [],
      onchainBuyAt,
    };

    const attributionResult = computeAttribution(attributionInput);

    // ── Risk evaluation ──────────────────────────────────────────────────────
    const riskInput: RiskInput = {
      campaignId,
      affiliateId: aff.id,
      affiliateWallet: aff.walletAddress,
      buyerWallet,
      clickCount: clicks,
      buyIntentCount: buyIntents,
      walletEventCount: walletConnects,
      attributedVolumeLamports: feeSnap
        ? feeSnap.claimedFeesLamports + feeSnap.unclaimedFeesLamports
        : BigInt(0),
      sameIpUaClickCount,
      sameIpUaWindowMinutes: REPEATED_CLICK_WINDOW_MINUTES,
      burstWalletCount,
      burstWindowMinutes: BURST_WINDOW_MINUTES,
      hasMissingWallet: clicks > 0 && walletConnects === 0,
    };
    const riskResult = evaluateRisk(riskInput);

    const totalRiskDelta = riskResult.flags.reduce((s, f) => s + f.scoreDelta, 0);
    const finalScore = Math.max(0, attributionResult.confidenceScore + totalRiskDelta);

    const status: ConversionStatus =
      riskResult.riskLevel === "high"
        ? ConversionStatus.Suspicious
        : finalScore >= 80
          ? ConversionStatus.Confirmed
          : ConversionStatus.Candidate;

    const attributedVolume = feeSnap
      ? feeSnap.claimedFeesLamports + feeSnap.unclaimedFeesLamports
      : BigInt(0);

    // ── Upsert attribution_conversion ────────────────────────────────────────
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
          ...(onchainTxSignature ? { txSignature: onchainTxSignature } : {}),
          buyerWallet: buyerWallet ?? existingConversion.buyerWallet,
        },
      });
    } else if (buyIntents > 0 || walletConnects > 0) {
      await prisma.attributionConversion.create({
        data: {
          campaignId,
          affiliateId: aff.id,
          buyerWallet: buyerWallet ?? null,
          tokenMint: campaign.tokenMint,
          txSignature: onchainTxSignature ?? null,
          attributionType: attributionResult.attributionType as never,
          confidenceScore: finalScore,
          attributedVolumeLamports: attributedVolume,
          status: status as never,
          reason: attributionResult.reason,
        },
      });
    }

    // ── Write risk flags (stale flags already deleted at start of recompute) ─
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
      reason: attributionResult.reason,
      solscanLink: solscanLink ?? undefined,
      txSignature: onchainTxSignature,
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
