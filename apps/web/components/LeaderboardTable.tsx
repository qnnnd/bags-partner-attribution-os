import type { LeaderboardEntry } from "@bags/shared";
import { AttributionType, ConversionStatus, RiskSeverity } from "@bags/shared";
import { confidenceLabel, lamportsToSol } from "../lib/mock-data";

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

const ATTRIBUTION_BADGE: Record<AttributionType, { label: string; class: string }> = {
  [AttributionType.OnchainCandidate]: {
    label: "On-chain",
    class: "bg-green-500/20 text-green-400 border-green-500/30",
  },
  [AttributionType.WalletIntent]: {
    label: "Wallet Intent",
    class: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  },
  [AttributionType.Click]: {
    label: "Click",
    class: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  },
  [AttributionType.Confirmed]: {
    label: "Confirmed",
    class: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  },
};

const RISK_BADGE: Record<RiskSeverity, string> = {
  [RiskSeverity.High]: "bg-red-500/20 text-red-400 border-red-500/30",
  [RiskSeverity.Medium]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  [RiskSeverity.Low]: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Affiliate
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Clicks
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Buy Intents
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Conversions
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Confidence
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Type
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Claimed (SOL)
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Unclaimed (SOL)
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              Risk
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
              On-chain
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface-2)]">
          {entries.map((entry) => {
            const conf = confidenceLabel(entry.confidenceScore);
            const attrBadge =
              ATTRIBUTION_BADGE[entry.attributionType] ??
              ATTRIBUTION_BADGE[AttributionType.Click]!;
            return (
              <tr
                key={entry.affiliateId}
                className={`transition hover:bg-[var(--surface)] ${
                  entry.status === ConversionStatus.Suspicious
                    ? "opacity-60"
                    : ""
                }`}
              >
                <td className="px-4 py-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-300">
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{entry.displayName}</p>
                  <p className="font-mono text-xs text-[var(--muted)]">
                    {entry.refCode}
                  </p>
                  {entry.status === ConversionStatus.Suspicious && (
                    <span className="mt-0.5 inline-block rounded bg-red-500/20 px-1.5 py-0.5 text-xs text-red-400">
                      Suspicious
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  {entry.clicks.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  {entry.buyIntents.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-white">
                  {entry.attributedConversions.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`font-semibold ${conf.color}`}
                    title={entry.reason ?? undefined}
                  >
                    {conf.label} ({entry.confidenceScore})
                  </span>
                  {entry.reason && (
                    <p className="mt-0.5 text-xs text-[var(--muted)] max-w-[160px] truncate" title={entry.reason}>
                      {entry.reason}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs ${attrBadge.class}`}
                  >
                    {attrBadge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-green-400">
                  {lamportsToSol(entry.claimedFeesLamports)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-yellow-400">
                  {lamportsToSol(entry.unclaimedFeesLamports)}
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.riskLevel ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs ${RISK_BADGE[entry.riskLevel]}`}
                    >
                      {entry.riskLevel}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {entry.solscanLink ? (
                    <a
                      href={entry.solscanLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400 hover:bg-green-500/20 transition"
                      title={entry.txSignature}
                    >
                      ↗ Solscan
                    </a>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
