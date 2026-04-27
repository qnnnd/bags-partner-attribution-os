import { z } from "zod";
import { prisma } from "@bags/db";
import { buildSignMessage, verifyEd25519Signature } from "../../../../lib/auth";
import { getSession } from "../../../../lib/session";
import { badRequest, ok, unauthorized, serverError } from "../../../../lib/api-response";

const Body = z.object({
  walletAddress: z.string().min(32).max(64),
  signature: z.string().min(1),
  nonce: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid body");

    const { walletAddress, signature, nonce } = parsed.data;

    // Lookup stored session/nonce
    const stored = await prisma.walletSession.findFirst({
      where: { walletAddress },
      orderBy: { createdAt: "desc" },
    });

    if (!stored || stored.nonce !== nonce) {
      return unauthorized("Invalid or expired nonce");
    }
    if (stored.expiresAt < new Date()) {
      return unauthorized("Nonce expired");
    }

    // Verify Ed25519 signature
    const message = buildSignMessage(nonce);
    const valid = await verifyEd25519Signature(walletAddress, message, signature);
    if (!valid) return unauthorized("Invalid signature");

    // Mark session as used
    await prisma.walletSession.update({
      where: { id: stored.id },
      data: { signedMessage: message },
    });

    // Upsert user
    const user = await prisma.user.upsert({
      where: { walletAddress },
      create: { walletAddress, role: "creator" },
      update: {},
    });

    // Set iron-session cookie
    
    const session = await getSession();
    session.walletAddress = walletAddress;
    session.role = user.role as never;
    await session.save();

    return ok({ walletAddress: user.walletAddress, role: user.role });
  } catch (e) {
    console.error("[auth/verify-signature]", e);
    return serverError();
  }
}
