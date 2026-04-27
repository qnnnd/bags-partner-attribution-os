/**
 * POST /api/payouts/:payoutId/approve
 *
 * Creator approves a payout, optionally overriding the amount.
 *
 * Body: {
 *   approvedAmountLamports?: string   // defaults to suggestedAmountLamports
 *   forceOverride?: boolean           // allow approved > suggested (defaults to false)
 * }
 *
 * Rules:
 *   - Only pending_review rows can be approved
 *   - approved <= suggested unless forceOverride = true
 *   - Sets status = "approved"
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { lamportsToSolStr } from "../../../../../lib/csv";

interface RouteParams {
  params: Promise<{ payoutId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { payoutId } = await params;

  const ledger = await prisma.payoutLedger.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      status: true,
      suggestedAmountLamports: true,
      affiliateId: true,
    },
  });
  if (!ledger) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }
  if (ledger.status !== "pending_review") {
    return NextResponse.json(
      {
        error: `Cannot approve a payout in status "${ledger.status}". Only pending_review payouts can be approved.`,
      },
      { status: 400 },
    );
  }

  let body: { approvedAmountLamports?: string; forceOverride?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — defaults apply
  }

  const forceOverride = body.forceOverride === true;
  const approvedAmountLamports =
    body.approvedAmountLamports != null
      ? BigInt(body.approvedAmountLamports)
      : ledger.suggestedAmountLamports;

  if (!forceOverride && approvedAmountLamports > ledger.suggestedAmountLamports) {
    return NextResponse.json(
      {
        error: `Approved amount (${lamportsToSolStr(approvedAmountLamports)} SOL) exceeds suggested amount (${lamportsToSolStr(ledger.suggestedAmountLamports)} SOL). Set forceOverride=true to allow this.`,
      },
      { status: 400 },
    );
  }

  const updated = await prisma.payoutLedger.update({
    where: { id: payoutId },
    data: {
      status: "approved",
      approvedAmountLamports,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    approvedAmountLamports: updated.approvedAmountLamports?.toString() ?? null,
    approvedAmountSol: updated.approvedAmountLamports
      ? lamportsToSolStr(updated.approvedAmountLamports)
      : null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
