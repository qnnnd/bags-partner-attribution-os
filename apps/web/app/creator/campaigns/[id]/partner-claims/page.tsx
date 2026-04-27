/**
 * Partner Claim Status Page — /creator/campaigns/:id/partner-claims
 *
 * Displays per-affiliate partner fee snapshots and claim recommendations.
 * Read-only: claim execution happens manually off-platform (Phase 5).
 *
 * Claim recommendations:
 *   has_unclaimed_fees   — unclaimed > 0 → "Claimable fees available"
 *   no_claimable_fees    — unclaimed = 0 && claimed > 0 → "No fees to claim"
 *   needs_refresh        — no snapshot or snapshot older than 24h → "Refresh needed"
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@bags/db";
import { Nav } from "../../../../../components/Nav";
import { StatCard } from "../../../../../components/StatCard";
import { PartnerClaimsSyncButton } from "../../../../../components/PartnerClaimsSyncButton";
import { lamportsToSolStr } from "../../../../../lib/csv";

interface PageProps {
  params: Promise<{ id: string }>;
}

type ClaimRecommendation = "has_unclaimed_fees" | "no_claimable_fees" | "needs_refresh";

const RECOMMENDATION_CONFIG: Record<
  ClaimRecommendation,
  { label: string; badgeClass: string; description: string }
> = {
  has_unclaimed_fees: {
    label: "Claimable fees available",
    badgeClass: "border-green-500/30 bg-green-500/20 text-green-400",
    description: "This affiliate has unclaimed partner fees. Recommend claiming via manual wallet-signed flow.",
  },
  no_claimable_fees: {
    label: "No fees to claim",
    badgeClass: "border-gray-500/30 bg-gray-500/20 text-gray-400",
    description: "No unclaimed fees at last snapshot.",
  },
  needs_refresh: {
    label: "Refresh needed",
    badgeClass: "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
    description: "No snapshot in the last 24 hours. Sync partner stats to get up-to-date data.",
  },
};

function getRecommendation(snap: {
  unclaimedFeesLamports: bigint;
  claimedFeesLamports: bigint;
  snapshotAt: Date;
} | null): ClaimRecommendation {
  if (!snap) return "needs_refresh";
  const ageMs = Date.now() - snap.snapshotAt.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (ageMs > oneDayMs) return "needs_refresh";
  if (snap.unclaimedFeesLamports > BigInt(0)) return "has_unclaimed_fees";
  return "no_claimable_fees";
}

export default async function PartnerClaimsPage({ params }: PageProps) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, tokenMint: true },
  });
  if (!campaign) notFound();

  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId: id, status: "active" },
    orderBy: { createdAt: "asc" },
  });

  // Latest fee snapshot per affiliate
  const feeSnaps = await prisma.partnerFeeSnapshot.findMany({
    where: { campaignId: id, affiliateId: { not: null } },
    orderBy: { snapshotAt: "desc" },
    distinct: ["affiliateId"],
  });
  const feeMap = new Map(feeSnaps.map((s) => [s.affiliateId!, s]));

  // Aggregate stats
  const totalUnclaimed = feeSnaps.reduce(
    (s, snap) => s + snap.unclaimedFeesLamports,
    BigInt(0),
  );
  const totalClaimed = feeSnaps.reduce(
    (s, snap) => s + snap.claimedFeesLamports,
    BigInt(0),
  );
  const claimableCount = feeSnaps.filter((s) => s.unclaimedFeesLamports > BigInt(0)).length;
  const needsRefreshCount = affiliates.filter((a) => {
    const snap = feeMap.get(a.id);
    return getRecommendation(snap ?? null) === "needs_refresh";
  }).length;

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/creator/campaigns" className="hover:text-white transition">
            Campaigns
          </Link>
          <span>/</span>
          <Link href={`/creator/campaigns/${id}`} className="hover:text-white transition">
            {campaign.name}
          </Link>
          <span>/</span>
          <span className="text-white">Partner Claims</span>
        </nav>

        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Partner Claim Status</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              View affiliate partner fee snapshots and claim recommendations for{" "}
              <span className="font-medium text-white">{campaign.name}</span>
            </p>
          </div>
          <Link
            href={`/creator/campaigns/${id}/payouts`}
            className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition"
          >
            ← Payout Ledger
          </Link>
        </div>

        {/* Stats */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Claimed"
            value={`${lamportsToSolStr(totalClaimed)} SOL`}
            highlight={totalClaimed > BigInt(0)}
          />
          <StatCard
            label="Total Unclaimed"
            value={`${lamportsToSolStr(totalUnclaimed)} SOL`}
            highlight={totalUnclaimed > BigInt(0)}
          />
          <StatCard label="With Claimable Fees" value={claimableCount.toString()} />
          <StatCard label="Needs Refresh" value={needsRefreshCount.toString()} highlight={needsRefreshCount > 0} />
        </div>

        {/* Action: sync partner stats */}
        <div className="mb-6 flex items-center gap-3">
          <p className="text-sm text-[var(--muted)]">
            Snapshots are updated via <strong className="text-white">Sync Partner Stats</strong>.
          </p>
          <PartnerClaimsSyncButton campaignId={id} />
        </div>

        {/* Per-affiliate claim status table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Affiliate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Partner Config PDA
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Claimed (SOL)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Unclaimed (SOL)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Last Snapshot
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
                  Recommendation
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] bg-[var(--surface-2)]">
              {affiliates.map((aff) => {
                const snap = feeMap.get(aff.id) ?? null;
                const recommendation = getRecommendation(snap);
                const config = RECOMMENDATION_CONFIG[recommendation];
                return (
                  <tr key={aff.id} className="transition hover:bg-[var(--surface)]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{aff.displayName}</p>
                      <p className="font-mono text-xs text-[var(--muted)]">{aff.refCode}</p>
                      <p className="font-mono text-xs text-[var(--muted)] truncate max-w-[180px]" title={aff.walletAddress}>
                        {aff.walletAddress.slice(0, 8)}…{aff.walletAddress.slice(-6)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {aff.partnerConfigPda ? (
                        <span className="font-mono text-xs text-[var(--muted)]" title={aff.partnerConfigPda}>
                          {aff.partnerConfigPda.slice(0, 8)}…{aff.partnerConfigPda.slice(-6)}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-green-400">
                      {snap ? lamportsToSolStr(snap.claimedFeesLamports) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-yellow-400">
                      {snap ? lamportsToSolStr(snap.unclaimedFeesLamports) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-[var(--muted)]">
                      {snap ? snap.snapshotAt.toLocaleDateString() + " " + snap.snapshotAt.toLocaleTimeString() : "No snapshot"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${config.badgeClass}`}
                        title={config.description}
                      >
                        {config.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {affiliates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)] text-sm">
                    No active affiliates found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Notice */}
        <div className="mt-6 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs text-blue-400/80">
            <strong>Claim Notice:</strong> Claiming partner fees requires a wallet-signed transaction
            executed manually. This page is read-only. Use the scripts in{" "}
            <code className="font-mono">scripts/claim-partner-fees-mainnet.ts</code> (Phase 5) for
            on-chain claim execution. This platform never holds or transfers funds automatically.
          </p>
        </div>
      </main>
    </div>
  );
}

