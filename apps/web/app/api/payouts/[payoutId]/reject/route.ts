/**
 * POST /api/payouts/:payoutId/reject
 *
 * Creator rejects a payout. Allowed from pending_review or approved states.
 *
 * Body: { reason?: string }
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";

interface RouteParams {
  params: Promise<{ payoutId: string }>;
}

const REJECTABLE_STATUSES = new Set(["pending_review", "approved"]);

export async function POST(request: Request, { params }: RouteParams) {
  const { payoutId } = await params;

  const ledger = await prisma.payoutLedger.findUnique({
    where: { id: payoutId },
    select: { id: true, status: true },
  });
  if (!ledger) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }
  if (!REJECTABLE_STATUSES.has(ledger.status)) {
    return NextResponse.json(
      {
        error: `Cannot reject a payout in status "${ledger.status}". Only pending_review or approved payouts can be rejected.`,
      },
      { status: 400 },
    );
  }

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const updated = await prisma.payoutLedger.update({
    where: { id: payoutId },
    data: { status: "rejected" },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    reason: body.reason ?? null,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
