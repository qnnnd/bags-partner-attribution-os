import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@bags/db";
import { Nav } from "../../../../components/Nav";
import { StatCard } from "../../../../components/StatCard";
import { LeaderboardTable } from "../../../../components/LeaderboardTable";
import { MOCK_CAMPAIGN, MOCK_LEADERBOARD, lamportsToSol } from "../../../../lib/mock-data";
import type { LeaderboardEntry } from "@bags/shared";
import { AttributionType, ConversionStatus } from "@bags/shared";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetail({ params }: PageProps) {
  const { id } = await params;

  // Demo campaign — use Phase 0 mock data
  if (id === MOCK_CAMPAIGN.id) {
    const { stats } = MOCK_CAMPAIGN;
    const totalClaimed = MOCK_LEADERBOARD.reduce((s, e) => s + Number(e.claimedFeesLamports), 0);
    const totalUnclaimed = MOCK_LEADERBOARD.reduce((s, e) => s + Number(e.unclaimedFeesLamports), 0);
    return renderDetail(MOCK_CAMPAIGN.id, MOCK_CAMPAIGN.name, MOCK_CAMPAIGN.tokenMint, MOCK_CAMPAIGN.status, MOCK_CAMPAIGN.attributionWindowMinutes, stats.totalClicks, stats.walletConnects, stats.buyIntents, stats.attributedConversions, stats.lifetimeFeesLamports, totalClaimed, totalUnclaimed, MOCK_LEADERBOARD, true);
  }

  // Real campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      affiliates: { where: { status: "active" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!campaign) notFound();

  const eventCounts = await prisma.trackingEvent.groupBy({
    by: ["eventType"],
    where: { campaignId: id },
    _count: { _all: true },
  });
  const cm = Object.fromEntries(eventCounts.map((e) => [e.eventType, e._count._all]));
  const totalClicks = cm["visit"] ?? 0;
  const totalWalletConnects = cm["wallet_connect"] ?? 0;
  const totalBuyIntents = (cm["buy_click"] ?? 0) + (cm["outbound_to_bags"] ?? 0);

  const affiliateCounts = await prisma.trackingEvent.groupBy({
    by: ["affiliateId", "eventType"],
    where: { campaignId: id, affiliateId: { not: null } },
    _count: { _all: true },
  });
  const affMap = new Map<string, Record<string, number>>();
  for (const row of affiliateCounts) {
    if (!row.affiliateId) continue;
    const e = affMap.get(row.affiliateId) ?? {};
    e[row.eventType] = row._count._all;
    affMap.set(row.affiliateId, e);
  }

  const leaderboard: LeaderboardEntry[] = campaign.affiliates.map((aff, idx) => {
    const counts = affMap.get(aff.id) ?? {};
    const clicks = counts["visit"] ?? 0;
    const wc = counts["wallet_connect"] ?? 0;
    const bi = (counts["buy_click"] ?? 0) + (counts["outbound_to_bags"] ?? 0);
    const score = (clicks > 0 ? 20 : 0) + (wc > 0 ? 25 : 0) + (bi > 0 ? 20 : 0);
    return {
      rank: idx + 1,
      affiliateId: aff.id,
      displayName: aff.displayName,
      walletAddress: aff.walletAddress,
      refCode: aff.refCode,
      clicks,
      walletConnects: wc,
      buyIntents: bi,
      attributedConversions: bi > 0 ? 1 : 0,
      confidenceScore: score,
      attributionType: bi > 0 ? AttributionType.WalletIntent : AttributionType.Click,
      claimedFeesLamports: 0,
      unclaimedFeesLamports: 0,
      status: ConversionStatus.Candidate,
      riskLevel: null,
    };
  });
  leaderboard.sort((a, b) => b.confidenceScore - a.confidenceScore);
  leaderboard.forEach((e, i) => { e.rank = i + 1; });

  const attributedCount = leaderboard.filter((e) => e.buyIntents > 0).length;

  return renderDetail(campaign.id, campaign.name, campaign.tokenMint, campaign.status, campaign.attributionWindowMinutes, totalClicks, totalWalletConnects, totalBuyIntents, attributedCount, 0, 0, 0, leaderboard, false);
}

function renderDetail(
  id: string, name: string, tokenMint: string, status: string, window: number,
  totalClicks: number, walletConnects: number, buyIntents: number, attributed: number,
  lifetimeFees: number, totalClaimed: number, totalUnclaimed: number,
  leaderboard: LeaderboardEntry[], isMock: boolean,
) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/creator/campaigns" className="hover:text-white transition">Campaigns</Link>
          <span>/</span>
          <span className="text-white">{name}</span>
        </nav>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{name}</h1>
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status === "active" ? "border-green-500/30 bg-green-500/20 text-green-400" : "border-yellow-500/30 bg-yellow-500/20 text-yellow-400"}`}>{status}</span>
              {isMock && <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-300">Demo</span>}
            </div>
            <p className="mt-1 font-mono text-sm text-[var(--muted)]">Token: {tokenMint.slice(0, 12)}…{tokenMint.slice(-8)}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Attribution window: {window / 60}h • ID: {id}</p>
          </div>
          {!isMock && (
            <Link href={`/creator/campaigns/${id}/affiliates/new`} className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition">
              + Add Affiliate
            </Link>
          )}
        </div>

        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Clicks" value={totalClicks.toLocaleString()} />
          <StatCard label="Wallet Connects" value={walletConnects.toLocaleString()} />
          <StatCard label="Buy Intents" value={buyIntents.toLocaleString()} />
          <StatCard label="Attributed" value={attributed.toLocaleString()} highlight />
        </div>

        {lifetimeFees > 0 && (
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            <StatCard label="Token Lifetime Fees" value={`${lamportsToSol(lifetimeFees)} SOL`} sub="mock Bags fees" highlight />
            <StatCard label="Total Claimed" value={`${lamportsToSol(totalClaimed)} SOL`} />
            <StatCard label="Total Unclaimed" value={`${lamportsToSol(totalUnclaimed)} SOL`} />
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Attribution Leaderboard</h2>
          <span className="text-xs text-[var(--muted)]">{leaderboard.length} affiliates • last-touch model{isMock ? " • mock data" : ""}</span>
        </div>
        <LeaderboardTable entries={leaderboard} />

        <div className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-xs text-yellow-500/80">
            <strong>Attribution Notice:</strong> These are <em>confidence-based attribution candidates</em>, not 100% verified conversions.
          </p>
        </div>
      </main>
    </div>
  );
}
