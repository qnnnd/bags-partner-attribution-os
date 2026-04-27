import { z } from "zod";
import { prisma } from "@bags/db";
import { getSession } from "../../../../../lib/session";
import { generateRefCode } from "../../../../../lib/ref-code";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
} from "../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return notFound("Campaign not found");
  if (campaign.creatorWallet !== session.walletAddress) return forbidden();

  const affiliates = await prisma.affiliate.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "asc" },
  });
  return ok(affiliates);
}

const AddBody = z.object({
  walletAddress: z.string().min(32).max(64),
  displayName: z.string().min(1).max(100),
  partnerWallet: z.string().min(32).max(64).optional().nullable(),
  refCode: z.string().min(4).max(20).optional(),
});

export async function POST(req: Request, { params }: RouteParams) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const { id: campaignId } = await params;

  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return notFound("Campaign not found");
    if (campaign.creatorWallet !== session.walletAddress) return forbidden();

    const parsed = AddBody.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const { walletAddress, displayName, partnerWallet } = parsed.data;

    // Generate unique ref_code (retry up to 3 times)
    let refCode = parsed.data.refCode ?? generateRefCode();
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await prisma.affiliate.findUnique({
        where: { campaignId_refCode: { campaignId, refCode } },
      });
      if (!existing) break;
      if (parsed.data.refCode) return conflict("ref_code already in use for this campaign");
      if (attempt === 2) return conflict("Could not generate unique ref_code, please retry");
      refCode = generateRefCode();
    }

    const affiliate = await prisma.affiliate.create({
      data: {
        campaignId,
        walletAddress,
        displayName,
        refCode,
        partnerWallet: partnerWallet ?? null,
        status: "active",
      },
    });

    return created(affiliate);
  } catch (e) {
    console.error("[POST /api/campaigns/:id/affiliates]", e);
    return serverError();
  }
}
