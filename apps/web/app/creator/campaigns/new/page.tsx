"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Nav } from "../../../../components/Nav";

export default function NewCampaignPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    tokenMint: "",
    bagsTokenUrl: "",
    attributionWindowMinutes: 1440,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tokenMint: form.tokenMint,
          bagsTokenUrl: form.bagsTokenUrl || null,
          attributionWindowMinutes: form.attributionWindowMinutes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create campaign");
      setStatus("success");
      router.push(`/creator/campaigns/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create campaign");
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
          <span className="text-white">New Campaign</span>
        </nav>

        <h1 className="mb-6 text-2xl font-bold text-white">Create Campaign</h1>

        <form onSubmit={handleSubmit} className="space-y-5" data-testid="campaign-form">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Campaign Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. BAGS Genesis Launch"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="campaign-name"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Token Mint Address *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. So11111111111111111111111111111111111111112"
              value={form.tokenMint}
              onChange={(e) => setForm({ ...form, tokenMint: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="campaign-token-mint"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Bags Token URL (optional)
            </label>
            <input
              type="url"
              placeholder="https://bags.fm/token/..."
              value={form.bagsTokenUrl}
              onChange={(e) => setForm({ ...form, bagsTokenUrl: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
              data-testid="campaign-bags-url"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--muted)]">
              Attribution Window
            </label>
            <select
              value={form.attributionWindowMinutes}
              onChange={(e) => setForm({ ...form, attributionWindowMinutes: Number(e.target.value) })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value={60}>1 hour</option>
              <option value={360}>6 hours</option>
              <option value={720}>12 hours</option>
              <option value={1440}>24 hours (default)</option>
              <option value={4320}>3 days</option>
              <option value={10080}>7 days</option>
            </select>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition"
            data-testid="campaign-submit"
          >
            {status === "loading" ? "Creating…" : "Create Campaign"}
          </button>
        </form>
      </main>
    </div>
  );
}
