/**
 * API authentication helpers.
 *
 * requireCreatorSession — verifies the request has a valid iron-session.
 * requireCampaignCreator — additionally verifies the session wallet owns the campaign.
 */
import { NextResponse } from "next/server";
import { prisma } from "@bags/db";
import { getSession } from "./session";

export interface AuthError {
  response: NextResponse;
}

/** Returns the authenticated wallet address, or a 401 response object. */
export async function requireCreatorSession(): Promise<
  { walletAddress: string; authError: null } | { walletAddress: null; authError: NextResponse }
> {
  const session = await getSession();
  if (!session.walletAddress) {
    return {
      walletAddress: null,
      authError: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { walletAddress: session.walletAddress, authError: null };
}

/** Returns the campaign (id only), or a 401/403/404 response object. */
export async function requireCampaignCreator(
  campaignId: string,
  walletAddress: string,
): Promise<
  | { campaign: { id: string; creatorWallet: string }; authError: null }
  | { campaign: null; authError: NextResponse }
> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, creatorWallet: true },
  });
  if (!campaign) {
    return {
      campaign: null,
      authError: NextResponse.json({ error: "Campaign not found" }, { status: 404 }),
    };
  }
  if (campaign.creatorWallet !== walletAddress) {
    return {
      campaign: null,
      authError: NextResponse.json({ error: "Forbidden: only the campaign creator can perform this action" }, { status: 403 }),
    };
  }
  return { campaign, authError: null };
}
