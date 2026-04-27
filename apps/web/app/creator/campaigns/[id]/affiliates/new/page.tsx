"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Nav } from "../../../../../../components/Nav";

export default function NewAffiliatePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [form, setForm] = useState({ walletAddress: "", displayName: "", refCode: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/affiliates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: form.walletAddress,
          displayName: form.displayName,
          refCode: form.refCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add affiliate");
      router.push(`/creator/campaigns/${campaignId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add affiliate");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-xl px-6 py-10">
        <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Link href="/creator/campaigns" className="hover:text-white transition">Campaigns</Link>
          <span>/</span>
          <Link href={`/creator/campaigns/${campaignId}`} className="hover:text-white transition">Campaign</Link>
          <span>/</span>
          <span className="text-white">Add Affiliate</span>
        </nav>

        <h1 className="mb-6 text-2xl font-bold text-white">Add Affiliate</h1>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="affiliate-form">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Affiliate Wallet Address *</label>
            <input
              type="text"
              required
              placeholder="Solana wallet address"
              value={form.walletAddress}
              onChange={(e) => setForm({ ...form, walletAddress: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="affiliate-wallet"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">Display Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Alice.sol"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="affiliate-name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Ref Code (optional — auto-generated if empty)
            </label>
            <input
              type="text"
              placeholder="e.g. ALICE42"
              value={form.refCode}
              onChange={(e) => setForm({ ...form, refCode: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="affiliate-refcode"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition"
            data-testid="affiliate-submit"
          >
            {status === "loading" ? "Adding…" : "Add Affiliate"}
          </button>
        </form>
      </main>
    </div>
  );
}
