import { prisma } from "@bags/db";
import { getSession } from "../../../../../lib/session";
import { ok, unauthorized, forbidden, notFound, serverError } from "../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: RouteParams) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { id } = await params;
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return notFound("Campaign not found");
    if (campaign.creatorWallet !== session.walletAddress) return forbidden();

    const updated = await prisma.campaign.update({
      where: { id },
      data: { status: "paused" },
    });
    return ok(updated);
  } catch (e) {
    console.error("[POST /api/campaigns/:id/pause]", e);
    return serverError();
  }
}
