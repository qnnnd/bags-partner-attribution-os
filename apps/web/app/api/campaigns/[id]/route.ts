import { z } from "zod";
import { prisma } from "@bags/db";
import { getSession } from "../../../../lib/session";
import {
  ok,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
} from "../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      affiliates: { orderBy: { createdAt: "asc" } },
      _count: { select: { trackingEvents: true, attributionConversions: true } },
    },
  });
  if (!campaign) return notFound("Campaign not found");
  return ok(campaign);
}

const PatchBody = z.object({
  name: z.string().min(1).max(100).optional(),
  tokenMint: z.string().min(32).max(64).optional(),
  bagsTokenUrl: z.string().url().nullable().optional(),
  attributionWindowMinutes: z.number().int().min(60).max(10080).optional(),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { id } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id } });
    if (!campaign) return notFound("Campaign not found");
    if (campaign.creatorWallet !== session.walletAddress) return forbidden();

    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const updated = await prisma.campaign.update({
      where: { id },
      data: parsed.data,
    });
    return ok(updated);
  } catch (e) {
    console.error("[PATCH /api/campaigns/:id]", e);
    return serverError();
  }
}
