/**
 * GET /api/bags/token/:mint/fees
 *
 * Returns the latest saved token_fee_snapshot for this mint,
 * plus a live fetch from BagsClient.
 */
import { prisma } from "@bags/db";
import { getBagsClient } from "../../../../../../lib/bags-client";
import { ok } from "../../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ mint: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { mint } = await params;

  // Latest saved snapshot
  const snapshot = await prisma.tokenFeeSnapshot.findFirst({
    where: { tokenMint: mint },
    orderBy: { snapshotAt: "desc" },
  });

  // Live fetch (won't throw — client has fallback built in)
  const live = await getBagsClient().getTokenLifetimeFees(mint);

  // Expose the per-call data source so UI can label fixture_fallback vs real_mainnet
  const dataSource = (live.raw?.source as string | undefined) ?? process.env.BAGS_CLIENT_MODE ?? "unknown";

  return ok({
    tokenMint: mint,
    live: {
      lifetimeFeesLamports: live.lifetimeFeesLamports.toString(),
      lastUpdatedAt: live.lastUpdatedAt.toISOString(),
      source: dataSource,
    },
    snapshot: snapshot
      ? {
          id: snapshot.id,
          lifetimeFeesLamports: snapshot.lifetimeFeesLamports?.toString() ?? null,
          snapshotAt: snapshot.snapshotAt.toISOString(),
        }
      : null,
    mode: process.env.BAGS_CLIENT_MODE ?? "mock",
    source: dataSource,
  });
}
