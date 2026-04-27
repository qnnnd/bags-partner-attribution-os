/**
 * POST /api/payouts/:payoutId/attach-tx
 *
 * Manually records a tx signature for a payout after the creator has
 * transferred funds off-platform.
 *
 * Body: {
 *   txSignature: string        // required, must pass format validation
 *   verifyOnChain?: boolean    // optional, defaults to false; read-only RPC check
 * }
 *
 * Flow:
 *   - Validates txSignature format
 *   - If verifyOnChain=true, calls verifyTxOnChain (read-only) to confirm the tx exists
 *     - If confirmed on-chain → status = "paid"
 *     - If not found on-chain → status = "tx_created" (may still be in-flight)
 *   - If verifyOnChain=false → status = "tx_created"
 *   - Only approved payouts can have a tx attached
 *
 * Safety: NEVER sends a transaction. NEVER requires SOL or private key.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { validateTxSignatureFormat, verifyTxOnChain } from "../../../../../lib/tx-validator";
import { solscanTxLink } from "@bags/bags-client";

interface RouteParams {
  params: Promise<{ payoutId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { payoutId } = await params;

  const ledger = await prisma.payoutLedger.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true },
  });
  if (!ledger) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }
  if (ledger.status !== "approved") {
    return NextResponse.json(
      {
        error: `Cannot attach a tx to a payout in status "${ledger.status}". Only approved payouts can have a tx attached.`,
      },
      { status: 400 },
    );
  }

  let body: { txSignature?: string; verifyOnChain?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { txSignature, verifyOnChain = false } = body;

  if (!txSignature) {
    return NextResponse.json({ error: "txSignature is required." }, { status: 400 });
  }

  // Format validation
  const formatResult = validateTxSignatureFormat(txSignature);
  if (!formatResult.valid) {
    return NextResponse.json({ error: formatResult.error }, { status: 400 });
  }

  let newStatus: "tx_created" | "paid" = "tx_created";
  let onChainVerified = false;
  let onChainErr: string | null = null;

  if (verifyOnChain) {
    const onChainResult = await verifyTxOnChain(txSignature.trim());
    onChainVerified = onChainResult.exists;
    onChainErr = onChainResult.err ?? null;
    if (onChainResult.exists && !onChainResult.err) {
      newStatus = "paid";
    }
  }

  const updated = await prisma.payoutLedger.update({
    where: { id: payoutId },
    data: {
      txSignature: txSignature.trim(),
      status: newStatus,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    txSignature: updated.txSignature,
    solscanLink: updated.txSignature ? solscanTxLink(updated.txSignature) : null,
    onChainVerified,
    onChainErr,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
