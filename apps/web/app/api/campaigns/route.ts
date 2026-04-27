import { z } from "zod";
import { prisma } from "@bags/db";
import { getSession } from "../../../lib/session";
import { generateSlug } from "../../../lib/ref-code";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  conflict,
  serverError,
} from "../../../lib/api-response";

const CreateBody = z.object({
  name: z.string().min(1).max(100),
  tokenMint: z.string().min(32).max(64),
  bagsTokenUrl: z.string().url().optional().nullable(),
  attributionWindowMinutes: z.number().int().min(60).max(10080).default(1440),
});

export async function GET() {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  const campaigns = await prisma.campaign.findMany({
    where: { creatorWallet: session.walletAddress },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { affiliates: true, trackingEvents: true } },
    },
  });

  return ok(campaigns);
}

export async function POST(req: Request) {
  
  const session = await getSession();
  if (!session.walletAddress) return unauthorized();

  try {
    const parsed = CreateBody.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const { name, tokenMint, bagsTokenUrl, attributionWindowMinutes } = parsed.data;

    // Generate unique slug (retry up to 3 times)
    let slug = generateSlug(name);
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await prisma.campaign.findUnique({ where: { slug } });
      if (!existing) break;
      if (attempt === 2) return conflict("Could not generate unique slug, please retry");
      slug = generateSlug(name);
    }

    const campaign = await prisma.campaign.create({
      data: {
        creatorWallet: session.walletAddress,
        tokenMint,
        name,
        slug,
        bagsTokenUrl: bagsTokenUrl ?? null,
        attributionWindowMinutes,
        status: "draft",
      },
    });

    return created(campaign);
  } catch (e) {
    console.error("[POST /api/campaigns]", e);
    return serverError();
  }
}
