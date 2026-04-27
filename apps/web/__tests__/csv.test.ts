import { describe, it, expect } from "vitest";
import { buildCsv, lamportsToSolStr } from "../lib/csv";

describe("buildCsv", () => {
  it("generates correct CSV with header row", () => {
    const headers = ["name", "amount", "status"];
    const rows = [
      ["Alice", "1.5", "eligible"],
      ["Bob", "0.9", "flagged"],
    ];
    const csv = buildCsv(headers, rows);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("name,amount,status");
    expect(lines[1]).toBe("Alice,1.5,eligible");
    expect(lines[2]).toBe("Bob,0.9,flagged");
  });

  it("escapes values containing commas", () => {
    const csv = buildCsv(["value"], [["hello, world"]]);
    expect(csv).toContain('"hello, world"');
  });

  it("escapes values containing double quotes", () => {
    const csv = buildCsv(["value"], [['say "hi"']]);
    expect(csv).toContain('"say ""hi"""');
  });

  it("handles null and undefined values as empty string", () => {
    const csv = buildCsv(["a", "b"], [[null, undefined]]);
    expect(csv.split("\n")[1]).toBe(",");
  });

  it("handles empty rows array", () => {
    const csv = buildCsv(["col1", "col2"], []);
    expect(csv).toBe("col1,col2");
  });

  it("payout CSV has correct column count", () => {
    const PAYOUT_HEADERS = [
      "rank", "affiliate_display_name", "affiliate_wallet", "ref_code",
      "partner_config_pda", "clicks", "wallet_connects", "buy_intents",
      "confidence_score", "attribution_type", "status",
      "claimed_fees_sol", "unclaimed_fees_sol", "attributed_volume_sol",
      "risk_level", "risk_flags", "snapshot_at", "suggested_payout_note",
    ];
    const row = Array(PAYOUT_HEADERS.length).fill("test");
    const csv = buildCsv(PAYOUT_HEADERS, [row]);
    const lines = csv.split("\n");
    expect(lines[0]!.split(",").length).toBe(PAYOUT_HEADERS.length);
    expect(lines[1]!.split(",").length).toBe(PAYOUT_HEADERS.length);
  });
});

describe("lamportsToSolStr", () => {
  it("converts whole SOL amounts", () => {
    expect(lamportsToSolStr(BigInt(1_000_000_000))).toBe("1.000000000");
    expect(lamportsToSolStr(BigInt(250_000_000_000))).toBe("250.000000000");
  });

  it("converts fractional SOL amounts", () => {
    expect(lamportsToSolStr(BigInt(1_500_000_000))).toBe("1.500000000");
    expect(lamportsToSolStr(BigInt(3_200_000_000))).toBe("3.200000000");
  });

  it("handles zero", () => {
    expect(lamportsToSolStr(BigInt(0))).toBe("0.000000000");
  });

  it("handles string input", () => {
    expect(lamportsToSolStr("12500000000")).toBe("12.500000000");
  });

  it("handles null/undefined as zero", () => {
    expect(lamportsToSolStr(null)).toBe("0.000000000");
    expect(lamportsToSolStr(undefined)).toBe("0.000000000");
  });
});
