"use client";

/**
 * PayoutActions — client-side interactive payout row controls.
 * Handles approve, reject, and attach-tx actions for the payout ledger.
 */
import { useState } from "react";

interface PayoutRow {
  id: string;
  affiliateDisplayName: string;
  affiliateRefCode: string;
  suggestedAmountSol: string;
  suggestedAmountLamports: string;
  approvedAmountSol: string | null;
  status: string;
  txSignature: string | null;
  solscanLink: string | null;
  riskLevel: string | null;
  conversionStatus: string | null;
}

interface PayoutActionsProps {
  ledgers: PayoutRow[];
  campaignId: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_review: "border-yellow-500/30 bg-yellow-500/20 text-yellow-400",
  approved: "border-blue-500/30 bg-blue-500/20 text-blue-400",
  tx_created: "border-purple-500/30 bg-purple-500/20 text-purple-400",
  paid: "border-green-500/30 bg-green-500/20 text-green-400",
  rejected: "border-red-500/30 bg-red-500/20 text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  tx_created: "TX Created",
  paid: "Paid",
  rejected: "Rejected",
};

export function PayoutActions({ ledgers: initialLedgers, campaignId }: PayoutActionsProps) {
  const [ledgers, setLedgers] = useState(initialLedgers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});
  const [verifyOnChain, setVerifyOnChain] = useState<Record<string, boolean>>({});
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generateResult, setGenerateResult] = useState<string | null>(null);

  function updateLedger(updated: PayoutRow) {
    setLedgers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setGenerateResult(null);
    try {
      const res = await fetch(`/api/payouts/generate/${campaignId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generate failed");
      setGenerateResult(body.message);
      // Reload the page to show fresh data
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate payouts");
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(ledger: PayoutRow) {
    setLoadingId(ledger.id);
    setError(null);
    try {
      const overrideAmountStr = amountInputs[ledger.id];
      const body: { approvedAmountLamports?: string; forceOverride?: boolean } = {};
      if (overrideAmountStr && overrideAmountStr.trim() !== "") {
        // Convert SOL string to lamports
        const sol = parseFloat(overrideAmountStr);
        if (isNaN(sol) || sol < 0) throw new Error("Invalid amount");
        body.approvedAmountLamports = Math.floor(sol * 1_000_000_000).toString();
        // Allow override if amount differs from suggested
        if (body.approvedAmountLamports > ledger.suggestedAmountLamports) {
          body.forceOverride = true;
        }
      }
      const res = await fetch(`/api/payouts/${ledger.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { error?: string; status?: string; approvedAmountSol?: string };
      if (!res.ok) throw new Error(data.error ?? "Approve failed");
      updateLedger({
        ...ledger,
        status: data.status ?? ledger.status,
        approvedAmountSol: data.approvedAmountSol ?? ledger.suggestedAmountSol,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(ledger: PayoutRow) {
    if (!window.confirm(`Reject payout for ${ledger.affiliateDisplayName}?`)) return;
    setLoadingId(ledger.id);
    setError(null);
    try {
      const res = await fetch(`/api/payouts/${ledger.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by creator" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reject failed");
      updateLedger({ ...ledger, status: data.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setLoadingId(null);
    }
  }

  async function handleAttachTx(ledger: PayoutRow) {
    const sig = (txInputs[ledger.id] ?? "").trim();
    if (!sig) {
      setError("Please enter a transaction signature.");
      return;
    }
    setLoadingId(ledger.id);
    setError(null);
    try {
      const res = await fetch(`/api/payouts/${ledger.id}/attach-tx`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txSignature: sig, verifyOnChain: verifyOnChain[ledger.id] ?? false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Attach TX failed");
      updateLedger({
        ...ledger,
        status: data.status,
        txSignature: data.txSignature,
        solscanLink: data.solscanLink,
      });
      setTxInputs((prev) => ({ ...prev, [ledger.id]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attach TX failed");
    } finally {
      setLoadingId(null);
    }
  }

  const isSuspicious = (l: PayoutRow) => l.conversionStatus === "suspicious";

  return (
    <div>
      {/* Generate button */}
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 hover:bg-purple-500/20 transition disabled:opacity-50"
        >
          {generating ? "Generating…" : "Generate Suggested Payouts"}
        </button>
        {generateResult && (
          <span className="text-xs text-green-400">{generateResult}</span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Affiliate</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Suggested (SOL)</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Approved (SOL)</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Status</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Risk</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-[var(--muted)]">TX</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-[var(--surface-2)]">
            {ledgers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)] text-sm">
                  No payout entries yet. Click <strong className="text-white">Generate Suggested Payouts</strong> to create them.
                </td>
              </tr>
            )}
            {ledgers.map((ledger) => {
              const suspicious = isSuspicious(ledger);
              const isLoading = loadingId === ledger.id;
              const statusClass = STATUS_BADGE[ledger.status] ?? STATUS_BADGE["pending_review"];

              return (
                <tr
                  key={ledger.id}
                  className={`transition hover:bg-[var(--surface)] ${suspicious ? "opacity-50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{ledger.affiliateDisplayName}</p>
                    <p className="font-mono text-xs text-[var(--muted)]">{ledger.affiliateRefCode}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-yellow-400">
                    {ledger.suggestedAmountSol}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400">
                    {ledger.approvedAmountSol ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {suspicious ? (
                      <span className="rounded-full border border-red-500/30 bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
                        Ineligible
                      </span>
                    ) : (
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${statusClass}`}>
                        {STATUS_LABEL[ledger.status] ?? ledger.status}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ledger.riskLevel ? (
                      <span className="text-xs text-[var(--muted)]">{ledger.riskLevel}</span>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {ledger.solscanLink ? (
                      <a
                        href={ledger.solscanLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-400 hover:bg-green-500/20 transition"
                        title={ledger.txSignature ?? undefined}
                      >
                        ↗ Solscan
                      </a>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {suspicious ? (
                      <span className="text-xs text-[var(--muted)]">No actions (suspicious)</span>
                    ) : ledger.status === "pending_review" ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="0.001"
                            placeholder={ledger.suggestedAmountSol}
                            value={amountInputs[ledger.id] ?? ""}
                            onChange={(e) =>
                              setAmountInputs((prev) => ({ ...prev, [ledger.id]: e.target.value }))
                            }
                            className="w-24 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-white placeholder-[var(--muted)] focus:outline-none focus:border-purple-500/50"
                          />
                          <span className="text-xs text-[var(--muted)]">SOL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleApprove(ledger)}
                            disabled={isLoading}
                            className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-50"
                          >
                            {isLoading ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReject(ledger)}
                            disabled={isLoading}
                            className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            {isLoading ? "…" : "Reject"}
                          </button>
                        </div>
                      </div>
                    ) : ledger.status === "approved" ? (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="tx signature (87–88 chars)"
                          value={txInputs[ledger.id] ?? ""}
                          onChange={(e) =>
                            setTxInputs((prev) => ({ ...prev, [ledger.id]: e.target.value }))
                          }
                          className="w-48 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-white placeholder-[var(--muted)] focus:outline-none focus:border-purple-500/50"
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-xs text-[var(--muted)] cursor-pointer">
                            <input
                              type="checkbox"
                              checked={verifyOnChain[ledger.id] ?? false}
                              onChange={(e) =>
                                setVerifyOnChain((prev) => ({
                                  ...prev,
                                  [ledger.id]: e.target.checked,
                                }))
                              }
                              className="rounded"
                            />
                            Verify on RPC
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAttachTx(ledger)}
                            disabled={isLoading}
                            className="rounded border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-400 hover:bg-purple-500/20 transition disabled:opacity-50"
                          >
                            {isLoading ? "…" : "Attach TX"}
                          </button>
                          <button
                            onClick={() => handleReject(ledger)}
                            disabled={isLoading}
                            className="rounded border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : ledger.status === "tx_created" || ledger.status === "paid" ? (
                      <span className="text-xs text-[var(--muted)]">
                        {ledger.status === "paid" ? "Paid ✓" : "TX recorded — awaiting confirmation"}
                      </span>
                    ) : ledger.status === "rejected" ? (
                      <span className="text-xs text-[var(--muted)]">Rejected</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3">
        <p className="text-xs text-yellow-500/80">
          <strong>Payout Notice:</strong> This platform does not execute payments automatically.
          After approval, transfer funds manually to the affiliate wallet and record the tx signature here.
          No private keys are stored or used by this system.
        </p>
      </div>
    </div>
  );
}
