/**
 * Unit tests for the ownership-check logic of POST /api/bags/sync/token-fees.
 *
 * These are pure logic tests of the authorization rules — no real DB or HTTP
 * server is needed. They mirror the guard added to token-fees/route.ts.
 */
import { describe, it, expect } from "vitest";

// ─── Minimal types mirroring the route's session / campaign shapes ────────────

interface Session {
  walletAddress: string | null;
}

interface Campaign {
  id: string;
  creatorWallet: string;
}

// ─── Authorization helpers mirroring the route logic ─────────────────────────

type AuthResult =
  | { status: 401; error: "unauthorized" }
  | { status: 403; error: "forbidden" }
  | { status: 404; error: "not_found" }
  | { status: 200; ok: true };

function checkTokenFeesAuth(
  session: Session,
  campaignId: string | undefined,
  campaigns: Campaign[],
): AuthResult {
  if (!session.walletAddress) return { status: 401, error: "unauthorized" };

  if (campaignId) {
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return { status: 404, error: "not_found" };
    if (campaign.creatorWallet !== session.walletAddress) return { status: 403, error: "forbidden" };
  }

  return { status: 200, ok: true };
}

// ─── Test data ────────────────────────────────────────────────────────────────

const CAMPAIGNS: Campaign[] = [
  { id: "campaign-1", creatorWallet: "CreatorWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  { id: "campaign-2", creatorWallet: "CreatorWalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" },
];

const CREATOR_SESSION: Session = { walletAddress: "CreatorWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };
const OTHER_SESSION: Session = { walletAddress: "OtherWallet1111111111111111111111111111111111" };
const ANON_SESSION: Session = { walletAddress: null };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("token-fees auth: no campaignId", () => {
  it("authenticated user may query without campaignId", () => {
    const result = checkTokenFeesAuth(CREATOR_SESSION, undefined, CAMPAIGNS);
    expect(result.status).toBe(200);
  });

  it("unauthenticated user is rejected with 401 even without campaignId", () => {
    const result = checkTokenFeesAuth(ANON_SESSION, undefined, CAMPAIGNS);
    expect(result.status).toBe(401);
    expect((result as { error: string }).error).toBe("unauthorized");
  });
});

describe("token-fees auth: with campaignId", () => {
  it("campaign creator is allowed", () => {
    const result = checkTokenFeesAuth(CREATOR_SESSION, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(200);
  });

  it("unauthenticated session returns 401", () => {
    const result = checkTokenFeesAuth(ANON_SESSION, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(401);
  });

  it("non-owner returns 403", () => {
    const result = checkTokenFeesAuth(OTHER_SESSION, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(403);
    expect((result as { error: string }).error).toBe("forbidden");
  });

  it("non-existent campaign returns 404", () => {
    const result = checkTokenFeesAuth(CREATOR_SESSION, "campaign-999", CAMPAIGNS);
    expect(result.status).toBe(404);
    expect((result as { error: string }).error).toBe("not_found");
  });

  it("creator of campaign-1 cannot access campaign-2", () => {
    const result = checkTokenFeesAuth(CREATOR_SESSION, "campaign-2", CAMPAIGNS);
    expect(result.status).toBe(403);
  });

  it("creator of campaign-2 can access campaign-2", () => {
    const creatorB: Session = { walletAddress: "CreatorWalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" };
    const result = checkTokenFeesAuth(creatorB, "campaign-2", CAMPAIGNS);
    expect(result.status).toBe(200);
  });
});
