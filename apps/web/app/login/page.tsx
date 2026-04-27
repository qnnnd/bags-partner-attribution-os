"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "../../components/Nav";


export default function LoginPage() {
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  const isMockMode = process.env.NEXT_PUBLIC_BAGS_CLIENT_MODE === "mock";

  async function handleWalletLogin() {
    setStatus("loading");
    setError("");
    try {
      if (!window.solana?.isPhantom) {
        throw new Error("Phantom wallet not found. Install Phantom and reload the page.");
      }

      // Step 1: Connect wallet
      const { publicKey } = await window.solana.connect();
      const addr = publicKey.toString();

      // Step 2: Get nonce
      const nonceRes = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr }),
      });
      if (!nonceRes.ok) throw new Error("Failed to request sign-in nonce");
      const { nonce, message } = (await nonceRes.json()) as { nonce: string; message: string };

      // Step 3: Sign the message — no transaction, no SOL spent
      const msgBytes = new TextEncoder().encode(message);
      const { signature } = await window.solana.signMessage(msgBytes, "utf8");
      const sigBase64 = Buffer.from(signature).toString("base64");

      // Step 4: Verify signature server-side
      const verifyRes = await fetch("/api/auth/verify-signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: addr, signature: sigBase64, nonce }),
      });
      if (!verifyRes.ok) {
        const data = (await verifyRes.json()) as { error?: string };
        throw new Error(data.error ?? "Signature verification failed");
      }

      router.push("/creator/dashboard");
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login failed");
      setStatus("error");
    }
  }

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
        const data = (await res.json()) as { error?: string };
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

            {/* Real Phantom wallet sign-in */}
            <div className="mt-6">
              <button
                onClick={handleWalletLogin}
                disabled={status === "loading"}
                className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition"
                data-testid="wallet-login-btn"
              >
                {status === "loading" ? "Connecting…" : "Connect Phantom Wallet"}
              </button>
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              <p className="mt-2 text-center text-xs text-[var(--muted)]">
                Requires Phantom browser extension · Signs a message only — no transaction, no SOL spent
              </p>
            </div>

            {/* Dev login — only shown when NEXT_PUBLIC_BAGS_CLIENT_MODE=mock */}
            {isMockMode && (
              <div className="mt-6 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                  Mock Mode — Dev Login
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  No real wallet required. Optionally enter a wallet address, or leave empty to use the demo creator wallet.
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
                  className="mt-3 w-full rounded-lg bg-purple-600/70 py-2.5 text-sm font-semibold text-white hover:bg-purple-500/70 disabled:opacity-50 transition"
                  data-testid="dev-login-btn"
                >
                  {status === "loading" ? "Signing in…" : "Dev Login (Mock Mode)"}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
