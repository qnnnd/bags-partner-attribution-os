import { prisma } from "@bags/db";
import { TrackingEventType } from "@bags/shared";
import { handleTracking, type TrackingBodyInput } from "../../../../lib/tracking-handler";

export async function POST(req: Request) {
  return handleTracking(req, TrackingEventType.WalletConnect, async (data: TrackingBodyInput) => {
    if (data.walletAddress) {
      await prisma.user.upsert({
        where: { walletAddress: data.walletAddress },
        create: { walletAddress: data.walletAddress, role: "affiliate" },
        update: {},
      });
    }
  });
}
