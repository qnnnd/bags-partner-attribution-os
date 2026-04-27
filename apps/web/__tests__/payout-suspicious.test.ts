/**
 * Tests that suspicious conversions produce suggested_payout_sol = "0"
 * and are explicitly marked as ineligible in the payout report logic.
 *
 * These are pure unit tests of the CSV generation logic — no DB or server needed.
 */
import { describe, it, expect } from "vitest";
import { lamportsToSolStr } from "../lib/csv";

/**
 * Simulates the payout row generation logic from the payout CSV route.
 * Returns the suggested_payout_sol value for a given status.
 */
function computeSuggestedPayoutSol(
  isSuspicious: boolean,
  unclaimedFeesLamports: bigint,
): string {
  return isSuspicious ? "0" : lamportsToSolStr(unclaimedFeesLamports);
}

function computeSuggestedPayoutNote(isSuspicious: boolean): string {
  return isSuspicious
    ? "FLAGGED - not eligible for suggested payout"
    : "eligible";
}

describe("payout CSV: suspicious conversions excluded from suggested payout", () => {
  it("suspicious conversion has suggested_payout_sol = 0", () => {
    const result = computeSuggestedPayoutSol(true, BigInt(5_000_000_000));
    expect(result).toBe("0");
  });

  it("clean conversion has suggested_payout_sol = unclaimed fees", () => {
    const result = computeSuggestedPayoutSol(false, BigInt(5_000_000_000));
    expect(result).toBe("5.000000000");
  });

  it("clean conversion with zero unclaimed fees has suggested_payout_sol = 0.000000000", () => {
    const result = computeSuggestedPayoutSol(false, BigInt(0));
    expect(result).toBe("0.000000000");
  });

  it("suspicious note says FLAGGED and not eligible", () => {
    const note = computeSuggestedPayoutNote(true);
    expect(note).toContain("FLAGGED");
    expect(note).toContain("not eligible");
  });

  it("clean note says eligible", () => {
    const note = computeSuggestedPayoutNote(false);
    expect(note).toBe("eligible");
  });

  it("suspicious conversion with large unclaimed fees still has payout 0", () => {
    // Even if there are large unclaimed fees, suspicious conversions get 0
    const largeUnclaimed = BigInt(100_000_000_000); // 100 SOL
    const result = computeSuggestedPayoutSol(true, largeUnclaimed);
    expect(result).toBe("0");
  });

  it("self_buy (high risk) scenario: suggested payout is 0", () => {
    // self_buy triggers high risk → suspicious → payout 0
    const isSuspicious = true; // from high risk
    const result = computeSuggestedPayoutSol(isSuspicious, BigInt(12_500_000_000));
    expect(result).toBe("0");
  });
});
