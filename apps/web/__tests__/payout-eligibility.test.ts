/**
 * Payout eligibility business rules — integration-style unit tests.
 *
 * Tests the filtering logic that determines which affiliates are eligible
 * for suggested payout generation. Uses pure function logic mirroring
 * the generate route's rules without requiring a live DB.
 *
 * Business rules (from §9.3 + Phase 4):
 *  1. Suspicious conversions → NOT eligible
 *  2. No conversion record (non-last-touch) → NOT eligible
 *  3. Valid conversion (candidate or confirmed) → eligible
 *  4. fee snapshot amount is used for suggested payout only when eligible
 */
import { describe, expect, it } from "vitest";

// Mirror the eligibility check logic from the generate route
type ConversionStatus = "candidate" | "confirmed" | "suspicious";

interface MockConversion {
  affiliateId: string;
  status: ConversionStatus;
}

interface MockFeeSnap {
  affiliateId: string;
  unclaimedFeesLamports: bigint;
}

interface MockAffiliate {
  id: string;
  displayName: string;
}

function computePayoutEligibility(
  affiliates: MockAffiliate[],
  conversions: MockConversion[],
  feeSnaps: MockFeeSnap[],
): Array<{
  affiliateId: string;
  eligible: boolean;
  reason: string;
  suggestedLamports: bigint;
}> {
  const eligibleIds = new Set(
    conversions.filter((c) => c.status !== "suspicious").map((c) => c.affiliateId),
  );
  const suspiciousIds = new Set(
    conversions.filter((c) => c.status === "suspicious").map((c) => c.affiliateId),
  );
  const feeMap = new Map(feeSnaps.map((f) => [f.affiliateId, f.unclaimedFeesLamports]));

  return affiliates.map((aff) => {
    if (suspiciousIds.has(aff.id)) {
      return { affiliateId: aff.id, eligible: false, reason: "suspicious", suggestedLamports: BigInt(0) };
    }
    if (!eligibleIds.has(aff.id)) {
      return { affiliateId: aff.id, eligible: false, reason: "no_valid_attribution", suggestedLamports: BigInt(0) };
    }
    const lamports = feeMap.get(aff.id) ?? BigInt(0);
    return { affiliateId: aff.id, eligible: true, reason: "eligible", suggestedLamports: lamports };
  });
}

describe("payout eligibility", () => {
  const affiliates: MockAffiliate[] = [
    { id: "aff-A", displayName: "Alice" },
    { id: "aff-B", displayName: "Bob" },
    { id: "aff-C", displayName: "Carol" },
    { id: "aff-D", displayName: "Dave" },
  ];

  const feeSnaps: MockFeeSnap[] = [
    { affiliateId: "aff-A", unclaimedFeesLamports: BigInt(1_000_000_000) }, // A has fees but no conversion
    { affiliateId: "aff-B", unclaimedFeesLamports: BigInt(2_000_000_000) }, // B: valid conversion
    { affiliateId: "aff-C", unclaimedFeesLamports: BigInt(500_000_000) },  // C: suspicious
    // D: no fee snap, no conversion
  ];

  const conversions: MockConversion[] = [
    { affiliateId: "aff-B", status: "candidate" },   // valid
    { affiliateId: "aff-C", status: "suspicious" },  // flagged
  ];

  it("only B is eligible for payout (valid conversion + fees)", () => {
    const results = computePayoutEligibility(affiliates, conversions, feeSnaps);
    const B = results.find((r) => r.affiliateId === "aff-B")!;
    expect(B.eligible).toBe(true);
    expect(B.suggestedLamports).toBe(BigInt(2_000_000_000));
  });

  it("A has fees but NO conversion → not eligible (no_valid_attribution)", () => {
    const results = computePayoutEligibility(affiliates, conversions, feeSnaps);
    const A = results.find((r) => r.affiliateId === "aff-A")!;
    expect(A.eligible).toBe(false);
    expect(A.reason).toBe("no_valid_attribution");
    expect(A.suggestedLamports).toBe(BigInt(0));
  });

  it("C has fees but SUSPICIOUS conversion → not eligible", () => {
    const results = computePayoutEligibility(affiliates, conversions, feeSnaps);
    const C = results.find((r) => r.affiliateId === "aff-C")!;
    expect(C.eligible).toBe(false);
    expect(C.reason).toBe("suspicious");
    expect(C.suggestedLamports).toBe(BigInt(0));
  });

  it("D has no fees and no conversion → not eligible", () => {
    const results = computePayoutEligibility(affiliates, conversions, feeSnaps);
    const D = results.find((r) => r.affiliateId === "aff-D")!;
    expect(D.eligible).toBe(false);
    expect(D.reason).toBe("no_valid_attribution");
    expect(D.suggestedLamports).toBe(BigInt(0));
  });

  it("exactly 1 affiliate is eligible (B only)", () => {
    const results = computePayoutEligibility(affiliates, conversions, feeSnaps);
    const eligible = results.filter((r) => r.eligible);
    expect(eligible).toHaveLength(1);
    expect(eligible[0]!.affiliateId).toBe("aff-B");
  });

  it("confirmed conversion is also eligible", () => {
    const conversionsWithConfirmed: MockConversion[] = [
      { affiliateId: "aff-B", status: "confirmed" },
    ];
    const results = computePayoutEligibility(affiliates, conversionsWithConfirmed, feeSnaps);
    expect(results.find((r) => r.affiliateId === "aff-B")!.eligible).toBe(true);
  });

  it("after last-touch recompute, non-last-touch affiliate loses conversion → not eligible", () => {
    // Simulate: A had a conversion in previous run but after last-touch recompute
    // it was deleted because B was the last-touch winner.
    // Now A has no conversion → should not be eligible.
    const afterRecompute: MockConversion[] = [
      { affiliateId: "aff-B", status: "candidate" }, // only B survived
    ];
    const results = computePayoutEligibility(affiliates, afterRecompute, feeSnaps);
    expect(results.find((r) => r.affiliateId === "aff-A")!.eligible).toBe(false);
    expect(results.find((r) => r.affiliateId === "aff-B")!.eligible).toBe(true);
  });
});
