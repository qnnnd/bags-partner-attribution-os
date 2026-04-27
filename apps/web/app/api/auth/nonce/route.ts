import { z } from "zod";
import { prisma } from "@bags/db";
import { generateNonce, buildSignMessage } from "../../../../lib/auth";
import { badRequest, ok, serverError } from "../../../../lib/api-response";

const Body = z.object({
  walletAddress: z.string().min(32).max(64),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const { walletAddress } = parsed.data;
    const nonce = generateNonce();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

    // Delete any existing sessions for this wallet, then create fresh
    await prisma.walletSession.deleteMany({ where: { walletAddress } });
    await prisma.walletSession.create({ data: { walletAddress, nonce, expiresAt } });

    return ok({ nonce, message: buildSignMessage(nonce) });
  } catch (e) {
    console.error("[auth/nonce]", e);
    return serverError();
  }
}
