"use client";

interface Props {
  campaignId: string;
}

export function PartnerClaimsSyncButton({ campaignId }: Props) {
  async function handleSync() {
    const res = await fetch("/api/bags/sync/partner-stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId }),
    });
    if (res.ok) window.location.reload();
  }

  return (
    <button
      onClick={handleSync}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] hover:text-white hover:border-white/20 transition"
    >
      Sync Partner Stats
    </button>
  );
}
