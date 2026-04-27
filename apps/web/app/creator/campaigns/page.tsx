import Link from "next/link";
import { prisma } from "@bags/db";
import { Nav } from "../../../components/Nav";
import { CampaignCard } from "../../../components/CampaignCard";
import { getSession } from "../../../lib/session";
import { MOCK_CAMPAIGN } from "../../../lib/mock-data";

export default async function CampaignList() {
  
  const session = await getSession();

  if (!session.walletAddress) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-7xl px-6 py-10">
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
            Showing demo campaign.{" "}
            <Link href="/login" className="underline hover:text-yellow-300">Sign in</Link> to manage yours.
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampaignCard id={MOCK_CAMPAIGN.id} name={MOCK_CAMPAIGN.name} tokenMint={MOCK_CAMPAIGN.tokenMint} status={MOCK_CAMPAIGN.status} totalClicks={MOCK_CAMPAIGN.stats.totalClicks} buyIntents={MOCK_CAMPAIGN.stats.buyIntents} attributedConversions={MOCK_CAMPAIGN.stats.attributedConversions} />
          </div>
        </main>
      </div>
    );
  }

  const campaigns = await prisma.campaign.findMany({
    where: { creatorWallet: session.walletAddress },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { trackingEvents: true } } },
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Campaigns</h1>
          <Link href="/creator/campaigns/new" className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition">
            + New Campaign
          </Link>
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
