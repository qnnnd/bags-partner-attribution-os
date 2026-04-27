import { prisma } from "@bags/db";
import { ok, notFound } from "../../../../../lib/api-response";

interface RouteParams {
  params: Promise<{ affiliateId: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const { affiliateId } = await params;
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: { campaign: { select: { slug: true } } },
  });
  if (!affiliate) return notFound("Affiliate not found");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const promoUrl = `${baseUrl}/c/${affiliate.campaign.slug}?ref=${affiliate.refCode}`;

  return ok({ promoUrl, refCode: affiliate.refCode, slug: affiliate.campaign.slug });
}
