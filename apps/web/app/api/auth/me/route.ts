import { getSession } from "../../../../lib/session";
import { ok, unauthorized } from "../../../../lib/api-response";

export async function GET() {
  
  const session = await getSession();

  if (!session.walletAddress) return unauthorized();

  return ok({ walletAddress: session.walletAddress, role: session.role });
}
