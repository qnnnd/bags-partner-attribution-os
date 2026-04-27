import { z } from "zod";
import type { TrackingEventType } from "@bags/shared";
import { prisma } from "@bags/db";
import { createTrackingEvent, resolveAffiliate } from "./tracking";
import { hashIp, hashUserAgent } from "./hash";
import { badRequest, created, notFound, serverError } from "./api-response";

export const TrackingBody = z.object({
  campaignId: z.string().min(1),
  sessionId: z.string().min(1),
  refCode: z.string().optional().nullable(),
  walletAddress: z.string().min(32).max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type TrackingBodyInput = z.infer<typeof TrackingBody>;

export async function handleTracking(
  req: Request,
  eventType: TrackingEventType,
  extraHandler?: (data: TrackingBodyInput, campaignTokenMint: string) => Promise<void>,
) {
  try {
    const parsed = TrackingBody.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const { campaignId, sessionId, refCode, walletAddress, metadata } = parsed.data;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { tokenMint: true },
    });
    if (!campaign) return notFound("Campaign not found");

    const affiliateId = await resolveAffiliate(campaignId, refCode);

    const event = await createTrackingEvent({
      campaignId,
      affiliateId,
      eventType,
      sessionId,
      walletAddress: walletAddress ?? null,
      tokenMint: campaign.tokenMint,
      refCode: refCode ?? null,
      ipHash: hashIp(req),
      userAgentHash: hashUserAgent(req),
      metadata: metadata ?? {},
    });

    if (extraHandler) {
      await extraHandler(parsed.data, campaign.tokenMint);
    }

    return created({ eventId: event.id, eventType, sessionId });
  } catch (e) {
    console.error(`[tracking/${eventType}]`, e);
    return serverError();
  }
}
