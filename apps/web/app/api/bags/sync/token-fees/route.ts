/**
 * POST /api/bags/sync/token-fees
 * Body: { tokenMint: string; campaignId?: string }
 *
 * Fetches the latest token lifetime fees from BagsClient and saves a
 * token_fee_snapshot to the database.
 */
import { z } from "zod";
import { prisma } from "@bags/db";
import { getBagsClient } from "../../../../../lib/bags-client";
import { getSession } from "../../../../../lib/session";
import { badRequest, created, serverError, unauthorized } from "../../../../../lib/api-response";

const Body = z.object({
  tokenMint: z.string().min(32).max(64),
  campaignId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  const { tokenMint, campaignId } = parsed.data;

  try {
    const client = getBagsClient();
    const stats = await client.getTokenLifetimeFees(tokenMint);

    const snapshot = await prisma.tokenFeeSnapshot.create({
      data: {
        tokenMint,
        campaignId: campaignId ?? null,
        lifetimeFeesLamports: stats.lifetimeFeesLamports,
        raw: (stats.raw ?? {}) as never,
        snapshotAt: stats.lastUpdatedAt,
      },
    });

    return created({
      snapshotId: snapshot.id,
      tokenMint,
      lifetimeFeesLamports: stats.lifetimeFeesLamports.toString(),
      snapshotAt: snapshot.snapshotAt.toISOString(),
    });
  } catch (e) {
    console.error("[POST /api/bags/sync/token-fees]", e);
    return serverError();
  }
}
