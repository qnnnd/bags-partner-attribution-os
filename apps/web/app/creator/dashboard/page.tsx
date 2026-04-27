import Link from "next/link";
import { prisma } from "@bags/db";
import { Nav } from "../../../components/Nav";
import { StatCard } from "../../../components/StatCard";
import { CampaignCard } from "../../../components/CampaignCard";
import { getSession } from "../../../lib/session";
import { MOCK_CAMPAIGN, lamportsToSol } from "../../../lib/mock-data";

export default async function CreatorDashboard() {
  
  const session = await getSession();

  // If not logged in, show mock demo data
  if (!session.walletAddress) {
    const { stats } = MOCK_CAMPAIGN;
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-7xl px-6 py-10">
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
            <span className="text-yellow-400 text-sm">
              Viewing demo data.{" "}
              <Link href="/login" className="underline hover:text-yellow-300">
                Sign in
              </Link>{" "}
              to manage your campaigns.
            </span>
          </div>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Clicks" value={stats.totalClicks.toLocaleString()} sub="across all campaigns" />
            <StatCard label="Wallet Connects" value={stats.walletConnects.toLocaleString()} />
            <StatCard label="Buy Intents" value={stats.buyIntents.toLocaleString()} />
            <StatCard label="Lifetime Fees" value={`${lamportsToSol(stats.lifetimeFeesLamports)} SOL`} highlight />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampaignCard id={MOCK_CAMPAIGN.id} name={MOCK_CAMPAIGN.name} tokenMint={MOCK_CAMPAIGN.tokenMint} status={MOCK_CAMPAIGN.status} totalClicks={stats.totalClicks} buyIntents={stats.buyIntents} attributedConversions={stats.attributedConversions} />
          </div>
        </main>
      </div>
    );
  }

  // Real data for logged-in creator
  const campaigns = await prisma.campaign.findMany({
    where: { creatorWallet: session.walletAddress },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trackingEvents: true, affiliates: true } } },
  });

  const eventCounts = await prisma.trackingEvent.groupBy({
    by: ["eventType"],
    where: { campaignId: { in: campaigns.map((c) => c.id) } },
    _count: { _all: true },
  });
  const countMap = Object.fromEntries(eventCounts.map((e) => [e.eventType, e._count._all]));

  const totalClicks = countMap["visit"] ?? 0;
  const totalWalletConnects = countMap["wallet_connect"] ?? 0;
  const totalBuyIntents = (countMap["buy_click"] ?? 0) + (countMap["outbound_to_bags"] ?? 0);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Creator Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Wallet:{" "}
              <span className="font-mono">
                {session.walletAddress.slice(0, 8)}…{session.walletAddress.slice(-4)}
              </span>
            </p>
          </div>
          <Link href="/creator/campaigns/new" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition">
            + New Campaign
          </Link>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Campaigns" value={campaigns.length} />
          <StatCard label="Total Clicks" value={totalClicks.toLocaleString()} />
          <StatCard label="Wallet Connects" value={totalWalletConnects.toLocaleString()} />
          <StatCard label="Buy Intents" value={totalBuyIntents.toLocaleString()} highlight />
        </div>

        {campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
            <p className="text-[var(--muted)]">No campaigns yet.</p>
            <Link href="/creator/campaigns/new" className="mt-3 inline-block text-sm text-purple-400 hover:text-purple-300 transition">
              Create your first campaign →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} id={c.id} name={c.name} tokenMint={c.tokenMint} status={c.status} totalClicks={c._count.trackingEvents} buyIntents={0} attributedConversions={0} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
