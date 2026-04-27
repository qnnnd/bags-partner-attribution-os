import Link from "next/link";

interface CampaignCardProps {
  id: string;
  name: string;
  tokenMint: string;
  status: string;
  totalClicks: number;
  buyIntents: number;
  attributedConversions: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  paused: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  archived: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function CampaignCard({
  id,
  name,
  tokenMint,
  status,
  totalClicks,
  buyIntents,
  attributedConversions,
}: CampaignCardProps) {
  const statusClass =
    STATUS_COLORS[status] ?? STATUS_COLORS["draft"]!;

  return (
    <Link href={`/creator/campaigns/${id}`}>
      <div className="group rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-purple-500/50 hover:bg-[var(--surface-2)]">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white group-hover:text-purple-300 transition">
              {name}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--muted)] font-mono">
              {tokenMint.slice(0, 8)}...{tokenMint.slice(-4)}
            </p>
          </div>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {status}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">Clicks</p>
            <p className="text-sm font-semibold text-white">
              {totalClicks.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Buy Intents</p>
            <p className="text-sm font-semibold text-white">
              {buyIntents.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Conversions</p>
            <p className="text-sm font-semibold text-white">
              {attributedConversions.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
