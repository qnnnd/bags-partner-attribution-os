import { z } from "zod";
import { prisma } from "@bags/db";
import { getSession } from "../../../../lib/session";
import { ok, badRequest, unauthorized, forbidden, notFound, serverError } from "../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { affiliateId } = await params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: { campaign: true },
  });
  if (!affiliate) return notFound("Affiliate not found");
  return ok(affiliate);
}

const PatchBody = z.object({
  displayName: z.string().min(1).max(100).optional(),
  partnerWallet: z.string().min(32).max(64).nullable().optional(),
  status: z.enum(["invited", "active", "paused"]).optional(),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { affiliateId } = await params;
  try {
    const affiliate = await prisma.affiliate.findUnique({
      where: { id: affiliateId },
      include: { campaign: true },
    });
    if (!affiliate) return notFound("Affiliate not found");
    if (affiliate.campaign.creatorWallet !== session.walletAddress) return forbidden();

    const parsed = PatchBody.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const updated = await prisma.affiliate.update({
      where: { id: affiliateId },
      data: parsed.data,
    });
    return ok(updated);
  } catch (e) {
    console.error("[PATCH /api/affiliates/:id]", e);
    return serverError();
  }
}
