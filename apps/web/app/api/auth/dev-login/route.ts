/**
 * Dev-only login endpoint — active only when BAGS_CLIENT_MODE=mock.
 * Allows E2E tests to set a session without going through wallet signing.
 */
import { z } from "zod";
import { prisma } from "@bags/db";
import { getSession } from "../../../../lib/session";
import { ok, forbidden, badRequest, serverError } from "../../../../lib/api-response";
import { MOCK_CREATOR_WALLET } from "@bags/shared";

const Body = z.object({
  walletAddress: z.string().min(32).max(64).optional(),
  role: z.enum(["creator", "affiliate"]).optional(),
});

export async function POST(req: Request) {
  if (process.env.BAGS_CLIENT_MODE !== "mock") {
    return forbidden("Dev login is only available in mock mode");
  }

  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return badRequest("Invalid body");

    const walletAddress = parsed.data.walletAddress ?? MOCK_CREATOR_WALLET;
    const role = (parsed.data.role ?? "creator") as "creator" | "affiliate";

    await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress, role },
      update: {},
    });

    
    const session = await getSession();
    session.walletAddress = walletAddress;
    session.role = role as never;
    await session.save();

    return ok({ walletAddress, role });
  } catch (e) {
    console.error("[auth/dev-login]", e);
    return serverError();
  }
}
