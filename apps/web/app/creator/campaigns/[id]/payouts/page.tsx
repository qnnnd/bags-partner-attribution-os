/**
 * Payout Ledger Page — /creator/campaigns/:id/payouts
 *
 * Shows the payout ledger for a campaign. Creator can generate suggested payouts,
 * approve/reject per-affiliate, override amounts, and record tx signatures.
 *
 * IMPORTANT: This platform does NOT execute payments automatically.
 * All fund transfers are done manually off-platform by the creator.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@bags/db";
import { Nav } from "../../../../../components/Nav";
import { StatCard } from "../../../../../components/StatCard";
import { PayoutActions } from "../../../../../components/PayoutActions";
import { solscanTxLink } from "@bags/bags-client";
import { lamportsToSolStr } from "../../../../../lib/csv";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PayoutsPage({ params }: PageProps) {
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { id: true, name: true, tokenMint: true, creatorWallet: true },
  });
  if (!campaign) notFound();

  const ledgers = await prisma.payoutLedger.findMany({
    where: { campaignId: id },
    orderBy: { suggestedAmountLamports: "desc" },
    include: {
      affiliate: {
        select: {
          displayName: true,
          walletAddress: true,
          refCode: true,
          partnerConfigPda: true,
        },
      },
    },
  });

  // Latest conversion per affiliate
  const conversions = await prisma.attributionConversion.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { affiliateId: true, status: true, confidenceScore: true },
  });
  const convMap = new Map<string, typeof conversions[0]>();
  for (const c of conversions) {
    if (!convMap.has(c.affiliateId)) convMap.set(c.affiliateId, c);
  }

  // Latest risk flags per affiliate
  const riskFlags = await prisma.riskFlag.findMany({
    where: { campaignId: id, affiliateId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { affiliateId: true, severity: true },
  });
  const riskMap = new Map<string, string>();
  for (const r of riskFlags) {
    if (!r.affiliateId) continue;
    if (!riskMap.has(r.affiliateId)) riskMap.set(r.affiliateId, r.severity);
  }

  const totalSuggested = ledgers.reduce(
    (s, l) => s + l.suggestedAmountLamports,
    BigInt(0),
  );
  const totalApproved = ledgers.reduce(
    (s, l) => s + (l.approvedAmountLamports ?? BigInt(0)),
    BigInt(0),
  );
  const pendingCount = ledgers.filter((l) => l.status === "pending_review").length;
  const approvedCount = ledgers.filter((l) => l.status === "approved").length;
  const paidCount = ledgers.filter((l) => l.status === "paid").length;
  const rejectedCount = ledgers.filter((l) => l.status === "rejected").length;

  const ledgerRows = ledgers.map((l) => {
    const conv = convMap.get(l.affiliateId);
    return {
      id: l.id,
      affiliateDisplayName: l.affiliate.displayName,
      affiliateRefCode: l.affiliate.refCode,
      suggestedAmountSol: lamportsToSolStr(l.suggestedAmountLamports),
      suggestedAmountLamports: l.suggestedAmountLamports.toString(),
      approvedAmountSol: l.approvedAmountLamports
        ? lamportsToSolStr(l.approvedAmountLamports)
        : null,
      status: l.status,
      txSignature: l.txSignature ?? null,
      solscanLink: l.txSignature ? solscanTxLink(l.txSignature) : null,
      riskLevel: riskMap.get(l.affiliateId) ?? null,
      conversionStatus: conv?.status ?? null,
    };
  });

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
          <span className="text-white">Payouts</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Payout Ledger</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Manage suggested payouts for{" "}
            <span className="font-medium text-white">{campaign.name}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Suggested"
            value={`${lamportsToSolStr(totalSuggested)} SOL`}
          />
          <StatCard
            label="Total Approved"
            value={`${lamportsToSolStr(totalApproved)} SOL`}
            highlight={totalApproved > BigInt(0)}
          />
          <StatCard
            label="Pending / Approved"
            value={`${pendingCount} / ${approvedCount}`}
          />
          <StatCard
            label="Paid / Rejected"
            value={`${paidCount} / ${rejectedCount}`}
            highlight={paidCount > 0}
          />
        </div>

        {/* Download CSV */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Payout Entries</h2>
          <div className="flex items-center gap-2">
            <a
              href={`/api/reports/campaign/${id}/payout.csv`}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-white/20 transition"
            >
              ↓ Export CSV
            </a>
            <Link
              href={`/creator/campaigns/${id}/partner-claims`}
              className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 hover:bg-blue-500/20 transition"
            >
              Partner Claims →
            </Link>
          </div>
        </div>

        {/* Interactive payout table */}
        <PayoutActions ledgers={ledgerRows} campaignId={id} />
      </main>
    </div>
  );
}
