"use client";

import { useEffect, useRef, useState } from "react";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 16);

interface Props {
  campaignId: string;
  tokenMint: string;
  refCode: string | null;
  bagsTokenUrl: string | null;
  affiliateName: string | null;
}

type TrackStatus = "idle" | "sent" | "error";

export function CampaignTracker({
  campaignId,
  tokenMint,
  refCode,
  bagsTokenUrl,
  affiliateName,
}: Props) {
  const sessionId = useRef<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [buyStatus, setBuyStatus] = useState<TrackStatus>("idle");

  // Get or create sessionId on mount
  useEffect(() => {
    let sid = sessionStorage.getItem("bags-session-id");
    if (!sid) {
      sid = nanoid();
      sessionStorage.setItem("bags-session-id", sid);
    }
    sessionId.current = sid;

    // Fire visit event
    fetch("/api/tracking/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId: sid, refCode, metadata: { referrer: document.referrer } }),
    }).catch(console.error);
  }, [campaignId, refCode]);

  async function handleWalletConnect() {
    const mockWallet = walletAddress || `MockBuyer${Math.random().toString(36).slice(2, 10)}111111111111111111111111111111`;
    setWalletAddress(mockWallet);
    setWalletConnected(true);

    await fetch("/api/tracking/wallet-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId: sessionId.current, refCode, walletAddress: mockWallet }),
    }).catch(console.error);
  }

  async function handleBuyOnBags() {
    setBuyStatus("idle");
    try {
      await fetch("/api/tracking/buy-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, sessionId: sessionId.current, refCode, walletAddress: walletAddress || null }),
      });
      await fetch("/api/tracking/outbound-to-bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, sessionId: sessionId.current, refCode, metadata: { tokenMint } }),
      });
      setBuyStatus("sent");
      if (bagsTokenUrl) {
        window.open(bagsTokenUrl, "_blank", "noopener,noreferrer");
      }
    } catch {
      setBuyStatus("error");
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {affiliateName && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
          Referred by <span className="font-semibold">{affiliateName}</span>
        </div>
      )}

      {!walletConnected ? (
        <button
          onClick={handleWalletConnect}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 text-sm font-semibold text-white hover:border-purple-500/50 transition"
          data-testid="connect-wallet-btn"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Wallet connected: <span className="font-mono text-xs">{walletAddress.slice(0, 8)}…</span>
        </div>
      )}

      <button
        onClick={handleBuyOnBags}
        className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-500 transition"
        data-testid="buy-on-bags-btn"
      >
        {buyStatus === "sent" ? "Opening Bags…" : "Buy on Bags"}
      </button>

      {buyStatus === "error" && (
        <p className="text-xs text-red-400">Failed to record event. Please try again.</p>
      )}

      <p className="text-center text-xs text-[var(--muted)]">
        Clicking &quot;Buy on Bags&quot; records a buy intent and opens the Bags token page in a new tab.
      </p>
    </div>
  );
}
