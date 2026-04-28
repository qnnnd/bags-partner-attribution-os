/**
 * GET /api/bags/partner/:wallet/stats
 *
 * Returns the latest saved partner_fee_snapshot for this wallet,
 * plus a live fetch from BagsClient.
 */
import { prisma } from "@bags/db";
import { getBagsClient } from "../../../../../../lib/bags-client";
import { ok } from "../../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ wallet: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { wallet } = await params;

  const snapshot = await prisma.partnerFeeSnapshot.findFirst({
    where: { partnerWallet: wallet },
    orderBy: { snapshotAt: "desc" },
  });

  const live = await getBagsClient().getPartnerClaimStats(wallet);
  const config = await getBagsClient().getPartnerConfig(wallet);

  const dataSource = (live.raw?.source as string | undefined) ?? process.env.BAGS_CLIENT_MODE ?? "unknown";

  return ok({
    partnerWallet: wallet,
    live: {
      claimedFeesLamports: live.claimedFeesLamports.toString(),
      unclaimedFeesLamports: live.unclaimedFeesLamports.toString(),
      partnerConfigPda: live.partnerConfigPda,
      lastClaimedAt: live.lastClaimedAt?.toISOString() ?? null,
      source: dataSource,
    },
    config: config
      ? {
          partnerConfigPda: config.partnerConfigPda,
          feeBps: config.feeBps,
          isActive: config.isActive,
          createdAt: config.createdAt.toISOString(),
        }
      : null,
    snapshot: snapshot
      ? {
          id: snapshot.id,
          claimedFeesLamports: snapshot.claimedFeesLamports.toString(),
          unclaimedFeesLamports: snapshot.unclaimedFeesLamports.toString(),
          snapshotAt: snapshot.snapshotAt.toISOString(),
        }
      : null,
    mode: process.env.BAGS_CLIENT_MODE ?? "mock",
    source: dataSource,
  });
}
