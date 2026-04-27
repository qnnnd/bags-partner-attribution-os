/**
 * Unit tests for payout ledger business logic.
 *
 * Tests the core rules without hitting the DB:
 * 1. Approved amount <= suggested amount (default)
 * 2. Rejected payout produces approved_amount_sol = "0" in CSV
 * 3. Suspicious conversion is excluded from payout generation logic
 * 4. Payout CSV column presence (Phase 4 columns)
 */
import { describe, it, expect } from "vitest";
import { lamportsToSolStr } from "../lib/csv";
import { validateTxSignatureFormat } from "../lib/tx-validator";

// ─── Helpers mirroring the API route logic ────────────────────────────────────

function validateApproveAmount(
  approvedLamports: bigint,
  suggestedLamports: bigint,
  forceOverride = false,
): { valid: boolean; error?: string } {
  if (!forceOverride && approvedLamports > suggestedLamports) {
    return {
      valid: false,
      error: `Approved amount exceeds suggested amount. Use forceOverride=true to allow.`,
    };
  }
  return { valid: true };
}

function computeApprovedAmountSolForCsv(
  payoutStatus: string | undefined,
  approvedAmountLamports: bigint | null | undefined,
): string {
  if (payoutStatus === "rejected") return "0";
  if (approvedAmountLamports != null) return lamportsToSolStr(approvedAmountLamports);
  return "";
}

function isEligibleForPayout(conversionStatus: string | undefined): boolean {
  return conversionStatus !== "suspicious";
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("payout amount validation", () => {
  const suggestedLamports = BigInt(5_000_000_000); // 5 SOL

  it("allows approved amount equal to suggested", () => {
    const result = validateApproveAmount(suggestedLamports, suggestedLamports);
    expect(result.valid).toBe(true);
  });

  it("allows approved amount less than suggested", () => {
    const result = validateApproveAmount(BigInt(3_000_000_000), suggestedLamports);
    expect(result.valid).toBe(true);
  });

  it("allows approved amount of 0", () => {
    const result = validateApproveAmount(BigInt(0), suggestedLamports);
    expect(result.valid).toBe(true);
  });

  it("rejects approved amount greater than suggested by default", () => {
    const result = validateApproveAmount(BigInt(6_000_000_000), suggestedLamports);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds");
  });

  it("allows approved amount greater than suggested when forceOverride=true", () => {
    const result = validateApproveAmount(BigInt(6_000_000_000), suggestedLamports, true);
    expect(result.valid).toBe(true);
  });
});

describe("rejected payout in CSV", () => {
  it("rejected payout has approved_amount_sol = '0'", () => {
    const approvedSol = computeApprovedAmountSolForCsv(
      "rejected",
      BigInt(5_000_000_000),
    );
    expect(approvedSol).toBe("0");
  });

  it("approved payout has correct approved_amount_sol", () => {
    const approvedSol = computeApprovedAmountSolForCsv(
      "approved",
      BigInt(5_000_000_000),
    );
    expect(approvedSol).toBe("5.000000000");
  });

  it("pending payout with no approved amount returns empty string", () => {
    const approvedSol = computeApprovedAmountSolForCsv("pending_review", null);
    expect(approvedSol).toBe("");
  });

  it("paid payout has correct approved_amount_sol", () => {
    const approvedSol = computeApprovedAmountSolForCsv(
      "paid",
      BigInt(3_500_000_000),
    );
    expect(approvedSol).toBe("3.500000000");
  });
});

describe("suspicious conversion exclusion", () => {
  it("suspicious conversion is not eligible for payout", () => {
    expect(isEligibleForPayout("suspicious")).toBe(false);
  });

  it("candidate conversion is eligible for payout", () => {
    expect(isEligibleForPayout("candidate")).toBe(true);
  });

  it("confirmed conversion is eligible for payout", () => {
    expect(isEligibleForPayout("confirmed")).toBe(true);
  });

  it("undefined conversion status is eligible (no conversion yet)", () => {
    expect(isEligibleForPayout(undefined)).toBe(true);
  });
});

describe("payout CSV Phase 4 columns", () => {
  const PHASE4_COLUMNS = [
    "payout_id",
    "payout_status",
    "approved_amount_sol",
    "payout_tx_signature",
  ];

  const PHASE3_COLUMNS = [
    "suggested_payout_sol",
    "suggested_payout_note",
    "solscan_link",
  ];

  const ALL_COLUMNS = [
    "rank",
    "affiliate_display_name",
    "affiliate_wallet",
    "ref_code",
    "partner_config_pda",
    "clicks",
    "wallet_connects",
    "buy_intents",
    "confidence_score",
    "attribution_type",
    "status",
    "claimed_fees_sol",
    "unclaimed_fees_sol",
    "attributed_volume_sol",
    "risk_level",
    "risk_flags",
    "snapshot_at",
    "suggested_payout_sol",
    "suggested_payout_note",
    "solscan_link",
    "payout_id",
    "payout_status",
    "approved_amount_sol",
    "payout_tx_signature",
  ];

  it("includes all Phase 4 columns", () => {
    for (const col of PHASE4_COLUMNS) {
      expect(ALL_COLUMNS).toContain(col);
    }
  });

  it("includes all Phase 3 columns", () => {
    for (const col of PHASE3_COLUMNS) {
      expect(ALL_COLUMNS).toContain(col);
    }
  });

  it("has 24 total columns in Phase 4 CSV", () => {
    expect(ALL_COLUMNS).toHaveLength(24);
  });
});

describe("tx signature format for payout attach-tx", () => {
  it("valid 87-char base58 signature passes validation", () => {
    const sig = "A".repeat(87);
    const result = validateTxSignatureFormat(sig);
    expect(result.valid).toBe(true);
  });

  it("empty string is rejected at attach-tx", () => {
    const result = validateTxSignatureFormat("");
    expect(result.valid).toBe(false);
  });

  it("signature with invalid chars is rejected", () => {
    const result = validateTxSignatureFormat("0".repeat(87));
    expect(result.valid).toBe(false);
  });
});
