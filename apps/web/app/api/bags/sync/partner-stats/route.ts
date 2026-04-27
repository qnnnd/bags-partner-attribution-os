/**
 * POST /api/bags/sync/partner-stats
 * Body: { campaignId: string; affiliateId?: string }
 *
 * For each active affiliate in the campaign (or a specific affiliate),
 * fetches their partner claim stats from BagsClient and saves snapshots.
 */
import { z } from "zod";
import { prisma } from "@bags/db";
import { getBagsClient } from "../../../../../lib/bags-client";
import { getSession } from "../../../../../lib/session";
import { badRequest, ok, serverError, unauthorized, notFound, forbidden } from "../../../../../lib/api-response";

const Body = z.object({
  campaignId: z.string().min(1),
  affiliateId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

  const { campaignId, affiliateId } = parsed.data;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return notFound("Campaign not found");
    if (campaign.creatorWallet !== session.walletAddress) return forbidden();

    const affiliates = await prisma.affiliate.findMany({
      where: {
        campaignId,
        status: "active",
        ...(affiliateId ? { id: affiliateId } : {}),
      },
    });

    const client = getBagsClient();
    const results: Array<{ affiliateId: string; snapshotId: string; claimed: string; unclaimed: string }> = [];

    for (const aff of affiliates) {
      const walletToQuery = aff.partnerWallet ?? aff.walletAddress;
      const stats = await client.getPartnerClaimStats(walletToQuery);

      const snapshot = await prisma.partnerFeeSnapshot.create({
        data: {
          campaignId,
          affiliateId: aff.id,
          partnerWallet: walletToQuery,
          partnerConfigPda: stats.partnerConfigPda ?? null,
          claimedFeesLamports: stats.claimedFeesLamports,
          unclaimedFeesLamports: stats.unclaimedFeesLamports,
          raw: (stats.raw ?? {}) as never,
          snapshotAt: new Date(),
        },
      });

      // Update affiliate with partner config PDA if we got one
      if (stats.partnerConfigPda && aff.partnerConfigPda !== stats.partnerConfigPda) {
        await prisma.affiliate.update({
          where: { id: aff.id },
          data: { partnerConfigPda: stats.partnerConfigPda },
        });
      }

      results.push({
        affiliateId: aff.id,
        snapshotId: snapshot.id,
        claimed: stats.claimedFeesLamports.toString(),
        unclaimed: stats.unclaimedFeesLamports.toString(),
      });
    }

    return ok({ synced: results.length, results });
  } catch (e) {
    console.error("[POST /api/bags/sync/partner-stats]", e);
    return serverError();
  }
}
