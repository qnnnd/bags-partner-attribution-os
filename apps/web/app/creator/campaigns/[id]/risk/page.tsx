/**
 * Risk Review Page — /creator/campaigns/:id/risk
 *
 * Displays all risk flags and suspicious conversions for a campaign.
 * Suspicious conversions are explicitly marked as ineligible for suggested payout.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@bags/db";
import { Nav } from "../../../../../components/Nav";
import { StatCard } from "../../../../../components/StatCard";
import { solscanTxLink } from "@bags/bags-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

const SEVERITY_BADGE: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/20 text-red-400",
  medium: "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
  low: "border-gray-500/30 bg-gray-500/20 text-gray-400",
};

const RISK_TYPE_LABEL: Record<string, string> = {
  self_buy: "Self Buy",
  repeated_click: "Repeated Click",
  tiny_buy: "Tiny Buy",
  abnormal_conversion: "Abnormal Conversion",
  burst_activity: "Burst Activity",
  new_wallet: "Missing Wallet",
  multi_wallet_pattern: "Multi-Wallet Pattern",
};

export default async function RiskReviewPage({ params }: PageProps) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, tokenMint: true },
  });
  if (!campaign) notFound();

  const flags = await prisma.riskFlag.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    include: {
      affiliate: {
        select: { displayName: true, walletAddress: true, refCode: true },
      },
    },
  });

  const suspiciousConversions = await prisma.attributionConversion.findMany({
    where: { campaignId: id, status: "suspicious" },
    orderBy: { createdAt: "desc" },
    include: {
      affiliate: {
        select: { displayName: true, walletAddress: true, refCode: true },
      },
    },
  });

  const highCount = flags.filter((f) => f.severity === "high").length;
  const mediumCount = flags.filter((f) => f.severity === "medium").length;

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
          <span className="text-white">Risk Review</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Risk Review</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Phase 3 fraud signal analysis for{" "}
            <span className="font-medium text-white">{campaign.name}</span>
          </p>
        </div>

        {/* Stats bar */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Flags" value={flags.length.toLocaleString()} />
          <StatCard label="High Risk" value={highCount.toLocaleString()} highlight={highCount > 0} />
          <StatCard label="Medium Risk" value={mediumCount.toLocaleString()} highlight={false} />
          <StatCard label="Suspicious" value={suspiciousConversions.length.toLocaleString()} highlight={suspiciousConversions.length > 0} />
        </div>

        {/* Suspicious Conversions — not eligible for payout */}
        {suspiciousConversions.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Suspicious Conversions</h2>
              <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                Not eligible for suggested payout
              </span>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 mb-4">
              <p className="text-xs text-red-400">
                These conversions are flagged as suspicious and will not appear in the suggested payout report.
                Creator review is required before any manual payout decision.
              </p>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Affiliate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Buyer Wallet</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Reason</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">On-chain</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface-2)]">
                  {suspiciousConversions.map((conv) => (
                    <tr key={conv.id} className="opacity-75">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{conv.affiliate.displayName}</p>
                        <p className="font-mono text-xs text-[var(--muted)]">{conv.affiliate.refCode}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                        {conv.buyerWallet ? `${conv.buyerWallet.slice(0, 8)}…${conv.buyerWallet.slice(-6)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-center text-red-400 font-semibold">
                        {conv.confidenceScore}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full border border-gray-500/30 bg-gray-500/20 px-2 py-0.5 text-xs text-gray-400">
                          {conv.attributionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] max-w-[300px]">
                        {conv.reason}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {conv.txSignature ? (
                          <a
                            href={solscanTxLink(conv.txSignature)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400 hover:bg-green-500/20 transition"
                          >
                            ↗ Solscan
                          </a>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Risk Flags Table */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Risk Flags</h2>
            <span className="text-xs text-[var(--muted)]">{flags.length} flag{flags.length !== 1 ? "s" : ""} total</span>
          </div>

          {flags.length === 0 ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
              <p className="text-[var(--muted)]">No risk flags detected.</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Run <strong className="text-white">Recompute Attribution</strong> from the campaign page to evaluate risk.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Affiliate</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Risk Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Severity</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Score Δ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Reason</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Detected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-[var(--surface-2)]">
                  {flags.map((flag) => (
                    <tr key={flag.id} className="transition hover:bg-[var(--surface)]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">
                          {flag.affiliate?.displayName ?? "Unknown"}
                        </p>
                        <p className="font-mono text-xs text-[var(--muted)]">
                          {flag.affiliate?.refCode ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-xs text-white">
                          {RISK_TYPE_LABEL[flag.riskType] ?? flag.riskType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs ${
                            SEVERITY_BADGE[flag.severity] ?? SEVERITY_BADGE["low"]
                          }`}
                        >
                          {flag.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">
                        <span className={flag.scoreDelta < 0 ? "text-red-400" : "text-[var(--muted)]"}>
                          {flag.scoreDelta < 0 ? flag.scoreDelta : "0"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-[var(--muted)] max-w-[360px]">
                        {flag.reason}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--muted)]">
                        {flag.createdAt.toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Notice */}
        <div className="mt-8 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-xs text-yellow-500/80">
            <strong>Risk Notice:</strong> Risk flags are heuristic signals, not definitive proof of fraud.
            Suspicious conversions are excluded from the suggested payout report.
            Creator review is always required before making any payout decisions.
          </p>
        </div>
      </main>
    </div>
  );
}
