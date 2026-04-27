import { TrackingEventType } from "@bags/shared";
import { prisma } from "@bags/db";

export interface TrackingPayload {
  campaignId: string;
  affiliateId?: string | null;
  eventType: TrackingEventType;
  sessionId: string;
  walletAddress?: string | null;
  tokenMint: string;
  refCode?: string | null;
  ipHash?: string | null;
  userAgentHash?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createTrackingEvent(payload: TrackingPayload): Promise<{ id: string }> {
  return prisma.trackingEvent.create({
    data: {
      campaignId: payload.campaignId,
      affiliateId: payload.affiliateId ?? null,
      eventType: payload.eventType as never,
      sessionId: payload.sessionId,
      walletAddress: payload.walletAddress ?? null,
      tokenMint: payload.tokenMint,
      refCode: payload.refCode ?? null,
      ipHash: payload.ipHash ?? null,
      userAgentHash: payload.userAgentHash ?? null,
      metadata: (payload.metadata ?? {}) as never,
    },
  });
}

/**
 * Resolves affiliateId from refCode + campaignId.
 */
export async function resolveAffiliate(
  campaignId: string,
  refCode: string | null | undefined,
): Promise<string | null> {
  if (!refCode) return null;
  const affiliate = await prisma.affiliate.findUnique({
    where: { campaignId_refCode: { campaignId, refCode } },
    select: { id: true },
  });
  return affiliate?.id ?? null;
}
