"use client";

import { useState } from "react";

interface Props {
  campaignId: string;
  tokenMint: string;
  sessionId: string;
  refCode?: string | null;
  walletAddress?: string | null;
  bagsTokenUrl?: string | null;
}

export function BuyOnBagsButton({
  campaignId,
  tokenMint,
  sessionId,
  refCode,
  walletAddress,
  bagsTokenUrl,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function handleClick() {
    setStatus("loading");
    try {
      await fetch("/api/tracking/buy-click", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, sessionId, refCode, walletAddress }),
      });
      await fetch("/api/tracking/outbound-to-bags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, sessionId, refCode, metadata: { tokenMint } }),
      });
      setStatus("done");
      if (bagsTokenUrl) window.open(bagsTokenUrl, "_blank", "noopener,noreferrer");
    } catch {
      setStatus("error");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === "loading"}
      className="w-full rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 transition"
      data-testid="buy-on-bags-btn"
    >
      {status === "loading" ? "Recording…" : status === "done" ? "Opening Bags…" : "Buy on Bags"}
    </button>
  );
}
