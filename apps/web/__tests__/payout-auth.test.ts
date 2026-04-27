/**
 * Unit tests for payout API authorization rules.
 *
 * These are pure logic tests — no real DB or HTTP server needed.
 * They verify the auth guard patterns used across:
 *   - POST /api/payouts/generate/:campaignId
 *   - POST /api/payouts/:payoutId/approve
 *   - POST /api/payouts/:payoutId/reject
 *   - POST /api/payouts/:payoutId/attach-tx
 */
import { describe, it, expect } from "vitest";

// ─── Minimal types mirroring session / campaign / payout shapes ───────────────

interface Session {
  walletAddress: string | null;
}

interface Campaign {
  id: string;
  creatorWallet: string;
}

interface PayoutEntry {
  id: string;
  campaignId: string;
  status: "pending_review" | "approved" | "rejected" | "tx_created" | "paid";
}

// ─── Auth helpers mirroring route guard logic ─────────────────────────────────

type AuthResult =
  | { status: 401; error: "unauthorized" }
  | { status: 403; error: "forbidden" }
  | { status: 404; error: "not_found" }
  | { status: 200; ok: true };

function checkCampaignOwnerAuth(
  session: Session,
  campaignId: string,
  campaigns: Campaign[],
): AuthResult {
  if (!session.walletAddress) return { status: 401, error: "unauthorized" };
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { status: 404, error: "not_found" };
  if (campaign.creatorWallet !== session.walletAddress) return { status: 403, error: "forbidden" };
  return { status: 200, ok: true };
}

function checkPayoutOwnerAuth(
  session: Session,
  payoutId: string,
  payouts: PayoutEntry[],
  campaigns: Campaign[],
): AuthResult {
  if (!session.walletAddress) return { status: 401, error: "unauthorized" };
  const payout = payouts.find((p) => p.id === payoutId);
  if (!payout) return { status: 404, error: "not_found" };
  return checkCampaignOwnerAuth(session, payout.campaignId, campaigns);
}

// ─── Test data ────────────────────────────────────────────────────────────────

const CAMPAIGNS: Campaign[] = [
  { id: "campaign-1", creatorWallet: "CreatorWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
  { id: "campaign-2", creatorWallet: "CreatorWalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" },
];

const PAYOUTS: PayoutEntry[] = [
  { id: "payout-1", campaignId: "campaign-1", status: "pending_review" },
  { id: "payout-2", campaignId: "campaign-2", status: "approved" },
];

const CREATOR_A: Session = { walletAddress: "CreatorWalletAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" };
const CREATOR_B: Session = { walletAddress: "CreatorWalletBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" };
const ANON: Session = { walletAddress: null };
const INTRUDER: Session = { walletAddress: "IntruderWallet111111111111111111111111111111" };

// ─── Tests: generate payouts ──────────────────────────────────────────────────

describe("payout generate: campaign owner auth", () => {
  it("campaign owner is allowed to generate payouts", () => {
    const result = checkCampaignOwnerAuth(CREATOR_A, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(200);
  });

  it("unauthenticated session returns 401", () => {
    const result = checkCampaignOwnerAuth(ANON, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(401);
    expect((result as { error: string }).error).toBe("unauthorized");
  });

  it("non-owner returns 403", () => {
    const result = checkCampaignOwnerAuth(INTRUDER, "campaign-1", CAMPAIGNS);
    expect(result.status).toBe(403);
    expect((result as { error: string }).error).toBe("forbidden");
  });

  it("non-existent campaign returns 404", () => {
    const result = checkCampaignOwnerAuth(CREATOR_A, "campaign-999", CAMPAIGNS);
    expect(result.status).toBe(404);
  });

  it("creator A cannot generate payouts for creator B's campaign", () => {
    const result = checkCampaignOwnerAuth(CREATOR_A, "campaign-2", CAMPAIGNS);
    expect(result.status).toBe(403);
  });
});

// ─── Tests: approve/reject/attach-tx (payout-level owner check) ──────────────

describe("payout approve/reject/attach-tx: owner auth", () => {
  it("campaign owner can approve their own payout", () => {
    const result = checkPayoutOwnerAuth(CREATOR_A, "payout-1", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(200);
  });

  it("unauthenticated session returns 401", () => {
    const result = checkPayoutOwnerAuth(ANON, "payout-1", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(401);
  });

  it("non-owner returns 403 when trying to approve another creator's payout", () => {
    const result = checkPayoutOwnerAuth(CREATOR_A, "payout-2", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(403);
  });

  it("random intruder returns 403", () => {
    const result = checkPayoutOwnerAuth(INTRUDER, "payout-1", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(403);
  });

  it("non-existent payout returns 404", () => {
    const result = checkPayoutOwnerAuth(CREATOR_A, "payout-999", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(404);
  });

  it("creator B can access their own payout", () => {
    const result = checkPayoutOwnerAuth(CREATOR_B, "payout-2", PAYOUTS, CAMPAIGNS);
    expect(result.status).toBe(200);
  });
});

// ─── Tests: suspicious conversion excluded from suggested payout ──────────────

describe("payout generation: suspicious exclusion", () => {
  type ConversionStatus = "suspicious" | "candidate" | "confirmed";

  function isEligibleForSuggestedPayout(status: ConversionStatus): boolean {
    return status !== "suspicious";
  }

  it("suspicious status is NOT eligible for suggested payout", () => {
    expect(isEligibleForSuggestedPayout("suspicious")).toBe(false);
  });

  it("candidate status IS eligible", () => {
    expect(isEligibleForSuggestedPayout("candidate")).toBe(true);
  });

  it("confirmed status IS eligible", () => {
    expect(isEligibleForSuggestedPayout("confirmed")).toBe(true);
  });

  it("non-last-touch affiliate should not appear in suggested payout (simulated)", () => {
    // When an affiliate is not the last touch for a buyer wallet,
    // the recomputeAttribution removes their conversion row, so they
    // have no conversion to be included in payout generation.
    const conversions: Array<{ affiliateId: string; status: ConversionStatus }> = [
      // aff-B won last-touch; aff-A has no conversion row (deleted)
      { affiliateId: "aff-B", status: "confirmed" },
    ];
    const affiliateIds = conversions
      .filter((c) => isEligibleForSuggestedPayout(c.status))
      .map((c) => c.affiliateId);
    expect(affiliateIds).toContain("aff-B");
    expect(affiliateIds).not.toContain("aff-A");
  });
});
