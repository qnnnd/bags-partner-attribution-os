/**
 * Attribution Aggregator — Phase 3 (last-touch fix)
 *
 * Implements §9.3 last-touch rules from the technical plan:
 *   1. Same session, multiple KOL clicks → attribute to the LAST touch by time.
 *   2. Same wallet, multiple affiliates in window → attribute to the most recent
 *      wallet intent (wallet_connect / buy_click / outbound_to_bags).
 *   3. High-risk conversions do not enter suggested payout.
 *
 * Key design:
 *   - All tracking events in the attribution window are loaded once.
 *   - Session-level and wallet-level last-touch maps are built cross-affiliate.
 *   - Only winning affiliates get attributionConversion records.
 *   - Non-winners' stale conversions are deleted so they cannot receive payout.
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

const INTENT_TYPES = new Set(["wallet_connect", "buy_click", "outbound_to_bags"]);

export function resolveLastTouchWinners(
  events: Array<{
    sessionId: string;
    affiliateId: string | null;
    eventType: string;
    walletAddress: string | null;
    createdAt: Date;
  }>,
): Set<string> {
  const ordered = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Same-session rule: for sessions without wallet, the latest affiliate touch wins.
  // Do not let an earlier buy_click beat a later ref-link visit; the rule is last touch by time.
  const sessionLastTouch = new Map<string, { affiliateId: string; at: Date }>();
  for (const ev of ordered) {
    if (!ev.affiliateId) continue;
    const existing = sessionLastTouch.get(ev.sessionId);
    if (!existing || ev.createdAt >= existing.at) {
      sessionLastTouch.set(ev.sessionId, { affiliateId: ev.affiliateId, at: ev.createdAt });
    }
  }

  // Wallet rule: where a wallet is known, the most recent wallet intent wins.
  const walletLastTouch = new Map<string, string>();
  for (const ev of ordered) {
    if (!ev.affiliateId || !ev.walletAddress || !INTENT_TYPES.has(ev.eventType)) continue;
    walletLastTouch.set(ev.walletAddress, ev.affiliateId);
  }

  const sessionsWithWallet = new Set<string>();
  for (const ev of ordered) {
    if (ev.walletAddress) sessionsWithWallet.add(ev.sessionId);
  }

  const winners = new Set<string>();

  for (const affiliateId of walletLastTouch.values()) {
    winners.add(affiliateId);
  }

  for (const [sessionId, { affiliateId }] of sessionLastTouch.entries()) {
    if (!sessionsWithWallet.has(sessionId)) {
      winners.add(affiliateId);
    }
  }

  return winners;
}

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

  await prisma.riskFlag.deleteMany({ where: { campaignId } });

  const bagsClient = createBagsClient();

  const allWindowEvents = await prisma.trackingEvent.findMany({
    where: {
      campaignId,
      affiliateId: { not: null },
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: "asc" },
    select: {
      sessionId: true,
      affiliateId: true,
      eventType: true,
      walletAddress: true,
      createdAt: true,
    },
  });

  const lastTouchWinnerIds = resolveLastTouchWinners(allWindowEvents);

  const affiliatesWithCurrentEvents = new Set<string>();
  for (const ev of allWindowEvents) {
    if (ev.affiliateId) affiliatesWithCurrentEvents.add(ev.affiliateId);
  }

  const eventMap = new Map<string, Record<string, number>>();
  for (const ev of allWindowEvents) {
    if (!ev.affiliateId) continue;
    const e = eventMap.get(ev.affiliateId) ?? {};
    e[ev.eventType] = (e[ev.eventType] ?? 0) + 1;
    eventMap.set(ev.affiliateId, e);
  }

  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

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
  const ipUaCountPerKey = new Map<string, number>();
  const sameIpUaMap = new Map<string, number>();
  for (const ev of ipUaEvents) {
    if (!ev.affiliateId || !ev.ipHash || !ev.userAgentHash) continue;
    const key = `${ev.affiliateId}:${ev.ipHash}:${ev.userAgentHash}`;
    const count = (ipUaCountPerKey.get(key) ?? 0) + 1;
    ipUaCountPerKey.set(key, count);
    const cur = sameIpUaMap.get(ev.affiliateId) ?? 0;
    if (count > cur) sameIpUaMap.set(ev.affiliateId, count);
  }

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
    const hasAttributionSignal = clicks > 0 || walletConnects > 0 || buyIntents > 0;
    const feeSnap = feeMap.get(aff.id);
    const buyerWallet = buyerWalletMap.get(aff.id);
    const burstWalletCount = burstWalletSets.get(aff.id)?.size ?? 0;
    const sameIpUaClickCount = sameIpUaMap.get(aff.id) ?? 0;
    const isLastTouch = lastTouchWinnerIds.has(aff.id);

    if (!isLastTouch && affiliatesWithCurrentEvents.has(aff.id)) {
      await prisma.attributionConversion.deleteMany({
        where: { campaignId, affiliateId: aff.id },
      });
    }

    let onchainTxSignature: string | undefined;
    let onchainBuyAt: Date | undefined;
    let solscanLink: string | undefined;

    if (isLastTouch && buyerWallet && (walletConnects > 0 || buyIntents > 0)) {
      try {
        const candidates = await bagsClient.getWalletTokenActivity(
          buyerWallet,
          campaign.tokenMint,
          windowStart,
        );
        if (candidates.length > 0) {
          const best = candidates.sort(
            (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
          )[0]!;
          onchainTxSignature = best.txSignature;
          onchainBuyAt = best.timestamp;
          solscanLink = best.solscanLink;
        }
      } catch {
        // Non-fatal: proceed without on-chain candidate
      }
    }

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
      signals: hasAttributionSignal ? [signal] : [],
      onchainBuyAt,
    };

    const attributionResult = computeAttribution(attributionInput);

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

    if (isLastTouch && hasAttributionSignal) {
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
      } else {
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
    }

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
      attributedConversions: isLastTouch && hasAttributionSignal ? 1 : 0,
      confidenceScore: finalScore,
      attributionType: attributionResult.attributionType as AttributionType,
      claimedFeesLamports: feeSnap ? Number(feeSnap.claimedFeesLamports) : 0,
      unclaimedFeesLamports: feeSnap ? Number(feeSnap.unclaimedFeesLamports) : 0,
      status,
      riskLevel: (riskResult.riskLevel as RiskSeverity) ?? null,
      reason: attributionResult.reason,
      solscanLink: solscanLink ?? undefined,
      txSignature: onchainTxSignature,
      isLastTouch,
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
  entries.forEach((e, i) => {
    e.rank = i + 1;
  });

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
