import Link from "next/link";
import { prisma } from "@bags/db";
import { Nav } from "../../../components/Nav";
import { StatCard } from "../../../components/StatCard";
import { getSession } from "../../../lib/session";
import {
  MOCK_CAMPAIGN,
  MOCK_LEADERBOARD,
  lamportsToSol,
  confidenceLabel,
} from "../../../lib/mock-data";

export default async function AffiliateDashboard() {
  
  const session = await getSession();

  if (!session.walletAddress) {
    // Show mock demo data for Alice
    const demo = MOCK_LEADERBOARD[0]!;
    const conf = confidenceLabel(demo.confidenceScore);
    const refLink = `http://localhost:3000/c/${MOCK_CAMPAIGN.slug}?ref=${demo.refCode}`;
    return renderDashboard(demo.displayName, demo.refCode, refLink, demo.clicks, demo.walletConnects, demo.buyIntents, demo.attributedConversions, Number(demo.claimedFeesLamports), Number(demo.unclaimedFeesLamports), demo.confidenceScore, conf.label, conf.color, String(demo.attributionType), true);
  }

  // Real data for logged-in affiliate
  const affiliates = await prisma.affiliate.findMany({
    where: { walletAddress: session.walletAddress, status: "active" },
    include: { campaign: { select: { slug: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (affiliates.length === 0) {
    return (
      <div className="flex min-h-screen flex-col">
        <Nav />
        <main className="mx-auto w-full max-w-5xl px-6 py-10">
          <h1 className="text-2xl font-bold text-white">Affiliate Dashboard</h1>
          <div className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-12 text-center">
            <p className="text-[var(--muted)]">You are not an affiliate in any active campaigns yet.</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Ask a creator to add your wallet address to their campaign.</p>
          </div>
        </main>
      </div>
    );
  }

  // Show first affiliate's stats
  const aff = affiliates[0]!;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const refLink = `${baseUrl}/c/${aff.campaign.slug}?ref=${aff.refCode}`;

  const eventCounts = await prisma.trackingEvent.groupBy({
    by: ["eventType"],
    where: { affiliateId: aff.id },
    _count: { _all: true },
  });
  const cm = Object.fromEntries(eventCounts.map((e) => [e.eventType, e._count._all]));
  const clicks = cm["visit"] ?? 0;
  const walletConnects = cm["wallet_connect"] ?? 0;
  const buyIntents = (cm["buy_click"] ?? 0) + (cm["outbound_to_bags"] ?? 0);

  const conv = await prisma.attributionConversion.findFirst({
    where: { affiliateId: aff.id },
    orderBy: { createdAt: "desc" },
  });
  const score = conv?.confidenceScore ?? (walletConnects > 0 ? 45 : clicks > 0 ? 20 : 0);
  const conf = confidenceLabel(score);

  const feeSnap = await prisma.partnerFeeSnapshot.findFirst({
    where: { affiliateId: aff.id },
    orderBy: { snapshotAt: "desc" },
  });

  return renderDashboard(
    aff.displayName, aff.refCode, refLink,
    clicks, walletConnects, buyIntents, conv ? 1 : 0,
    feeSnap ? Number(feeSnap.claimedFeesLamports) : 0,
    feeSnap ? Number(feeSnap.unclaimedFeesLamports) : 0,
    score, conf.label, conf.color, conv?.attributionType ?? "click", false,
  );
}

function renderDashboard(
  displayName: string, refCode: string, refLink: string,
  clicks: number, walletConnects: number, buyIntents: number, conversions: number,
  claimed: number, unclaimed: number,
  score: number, confLabel: string, confColor: string, attribType: string,
  isMock: boolean,
) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Affiliate Dashboard</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {isMock ? (
                <>Demo view for <span className="font-semibold text-purple-300">{displayName}</span> — <Link href="/login" className="underline hover:text-purple-300">sign in</Link> to see your data.</>
              ) : (
                <span className="font-semibold text-purple-300">{displayName}</span>
              )}
            </p>
          </div>
        </div>

        {/* Ref link */}
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Your Referral Link</p>
          <div className="flex items-center gap-3">
            <code className="flex-1 overflow-x-auto rounded-lg bg-[var(--surface-2)] px-4 py-2.5 text-sm text-purple-300" data-testid="ref-link">{refLink}</code>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Ref code: <span className="font-mono text-white">{refCode}</span></p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Clicks" value={clicks.toLocaleString()} />
          <StatCard label="Wallet Connects" value={walletConnects.toLocaleString()} />
          <StatCard label="Buy Intents" value={buyIntents.toLocaleString()} />
          <StatCard label="Conversions" value={conversions.toLocaleString()} highlight />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Claimed Fees" value={`${lamportsToSol(claimed)} SOL`} highlight />
          <StatCard label="Unclaimed Fees" value={`${lamportsToSol(unclaimed)} SOL`} />
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Attribution Confidence</p>
            <p className={`mt-1 text-2xl font-bold ${confColor}`}>{confLabel}</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Score: {score}/100 • {attribType}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
