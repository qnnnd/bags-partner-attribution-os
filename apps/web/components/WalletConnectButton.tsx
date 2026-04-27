"use client";

import { useState } from "react";

interface Props {
  campaignId: string;
  sessionId: string;
  refCode?: string | null;
  onConnected?: (walletAddress: string) => void;
}

export function WalletConnectButton({ campaignId, sessionId, refCode, onConnected }: Props) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [wallet, setWallet] = useState("");

  async function handleClick() {
    setStatus("connecting");
    // In Phase 1 mock mode: generate a mock wallet
    const mockWallet = `MockBuyer${Math.random().toString(36).slice(2, 10).toUpperCase()}111111111111111111111111111111`;
    setWallet(mockWallet);

    await fetch("/api/tracking/wallet-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId, refCode, walletAddress: mockWallet }),
    }).catch(console.error);

    setStatus("connected");
    onConnected?.(mockWallet);
  }

  if (status === "connected") {
    return (
      <div
        className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
        data-testid="wallet-connected"
      >
        Connected: <span className="font-mono text-xs">{wallet.slice(0, 8)}…</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "connecting"}
      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-white hover:border-purple-500/50 disabled:opacity-50 transition"
      data-testid="connect-wallet-btn"
    >
      {status === "connecting" ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
