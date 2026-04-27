"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "../../components/Nav";

export default function LoginPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const isMockMode = process.env.NEXT_PUBLIC_BAGS_CLIENT_MODE === "mock" || true;

  async function handleDevLogin() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/auth/dev-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: walletAddress || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Login failed");
      }
      router.push("/creator/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex flex-1 items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8">
            <h1 className="text-2xl font-bold text-white">Sign In</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Connect your Solana wallet to access the Creator or Affiliate dashboard.
            </p>

            {isMockMode && (
              <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Mock Mode — Dev Login
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  No real wallet required. Optionally enter a wallet address below, or leave empty to use the mock creator wallet.
                </p>
                <input
                  type="text"
                  placeholder="Wallet address (optional)"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-purple-500 focus:outline-none"
                  data-testid="wallet-input"
                />
                <button
                  onClick={handleDevLogin}
                  disabled={status === "loading"}
                  className="mt-3 w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition"
                  data-testid="dev-login-btn"
                >
                  {status === "loading" ? "Signing in…" : "Dev Login (Mock Mode)"}
                </button>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              </div>
            )}

            <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 opacity-50">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                Real Wallet Sign-In
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Phantom / Backpack wallet adapter — available in Phase 2.
              </p>
              <button
                disabled
                className="mt-3 w-full cursor-not-allowed rounded-lg border border-[var(--border)] py-2.5 text-sm text-[var(--muted)]"
              >
                Connect Wallet (Phase 2)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
