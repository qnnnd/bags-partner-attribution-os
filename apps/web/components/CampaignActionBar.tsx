"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  campaignId: string;
  isOwner: boolean;
}

export function CampaignActionBar({ campaignId, isOwner }: Props) {
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [recomputeStatus, setRecomputeStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSyncTokenFees() {
    setSyncStatus("syncing");
    setMessage("");
    try {
      // Get campaign token mint first
      const campaignRes = await fetch(`/api/campaigns/${campaignId}`);
      const campaign = await campaignRes.json();

      const res = await fetch("/api/bags/sync/token-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenMint: campaign.tokenMint, campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncStatus("done");
      setMessage(`Token fees synced: ${data.lifetimeFeesLamports} lamports`);
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e: unknown) {
      setSyncStatus("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  async function handleSyncPartnerStats() {
    setSyncStatus("syncing");
    setMessage("");
    try {
      const res = await fetch("/api/bags/sync/partner-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncStatus("done");
      setMessage(`Partner stats synced for ${data.synced} affiliates`);
      setTimeout(() => setSyncStatus("idle"), 3000);
    } catch (e: unknown) {
      setSyncStatus("error");
      setMessage(e instanceof Error ? e.message : "Sync failed");
    }
  }

  async function handleRecompute() {
    setRecomputeStatus("running");
    setMessage("");
    try {
      const res = await fetch(`/api/attribution/recompute/${campaignId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Recompute failed");
      setRecomputeStatus("done");
      setMessage(`Attribution recomputed for ${data.recomputed} affiliates`);
      setTimeout(() => { setRecomputeStatus("idle"); window.location.reload(); }, 2000);
    } catch (e: unknown) {
      setRecomputeStatus("error");
      setMessage(e instanceof Error ? e.message : "Recompute failed");
    }
  }

  if (!isOwner) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Bags Data Sync
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSyncTokenFees}
          disabled={syncStatus === "syncing"}
          className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/20 disabled:opacity-50 transition"
          data-testid="sync-token-fees-btn"
        >
          {syncStatus === "syncing" ? "Syncing…" : "Sync Token Fees"}
        </button>
        <button
          onClick={handleSyncPartnerStats}
          disabled={syncStatus === "syncing"}
          className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/20 disabled:opacity-50 transition"
          data-testid="sync-partner-stats-btn"
        >
          {syncStatus === "syncing" ? "Syncing…" : "Sync Partner Stats"}
        </button>
        <button
          onClick={handleRecompute}
          disabled={recomputeStatus === "running"}
          className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-300 hover:bg-green-500/20 disabled:opacity-50 transition"
          data-testid="recompute-btn"
        >
          {recomputeStatus === "running" ? "Recomputing…" : "Recompute Attribution"}
        </button>
        <Link
          href={`/api/reports/campaign/${campaignId}/payout.csv`}
          className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1.5 text-xs font-medium text-yellow-300 hover:bg-yellow-500/20 transition"
          data-testid="export-payout-csv"
        >
          Export Payout CSV
        </Link>
        <Link
          href={`/api/reports/campaign/${campaignId}/attribution.csv`}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-white transition"
          data-testid="export-attribution-csv"
        >
          Export Attribution CSV
        </Link>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${syncStatus === "error" || recomputeStatus === "error" ? "text-red-400" : "text-green-400"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
