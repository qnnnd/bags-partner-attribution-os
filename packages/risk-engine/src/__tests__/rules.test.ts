import { describe, it, expect } from "vitest";
import { RiskType, RiskSeverity } from "@bags/shared";
import {
  checkSelfBuy,
  checkRepeatedClick,
  checkTinyBuy,
  checkAbnormalConversion,
} from "../rules";
import { evaluateRisk } from "../index";
import type { RiskInput } from "../types";

const BASE_INPUT: RiskInput = {
  campaignId: "campaign-1",
  affiliateId: "affiliate-1",
  affiliateWallet: "AffiliateWallet11111111111111111111111111",
  clickCount: 50,
  buyIntentCount: 10,
  walletEventCount: 10,
  sameIpUaClickCount: 1,
  sameIpUaWindowMinutes: 60,
};

describe("checkSelfBuy", () => {
  it("returns null when buyer is different from affiliate", () => {
    const result = checkSelfBuy({
      ...BASE_INPUT,
      buyerWallet: "DifferentWallet1111111111111111111111111111",
    });
    expect(result).toBeNull();
  });

  it("returns null when no buyer wallet provided", () => {
    expect(checkSelfBuy(BASE_INPUT)).toBeNull();
  });

  it("returns high-severity self_buy flag when wallets match", () => {
    const result = checkSelfBuy({
      ...BASE_INPUT,
      buyerWallet: "AffiliateWallet11111111111111111111111111",
    });
    expect(result).not.toBeNull();
    expect(result!.riskType).toBe(RiskType.SelfBuy);
    expect(result!.severity).toBe(RiskSeverity.High);
    expect(result!.scoreDelta).toBeLessThan(0);
  });
});

describe("checkRepeatedClick", () => {
  it("returns null when click count is below threshold", () => {
    expect(checkRepeatedClick({ ...BASE_INPUT, sameIpUaClickCount: 5 })).toBeNull();
  });

  it("returns null when window exceeds threshold", () => {
    expect(
      checkRepeatedClick({
        ...BASE_INPUT,
        sameIpUaClickCount: 15,
        sameIpUaWindowMinutes: 60,
      }),
    ).toBeNull();
  });

  it("returns medium-severity repeated_click flag when threshold met within window", () => {
    const result = checkRepeatedClick({
      ...BASE_INPUT,
      sameIpUaClickCount: 10,
      sameIpUaWindowMinutes: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.riskType).toBe(RiskType.RepeatedClick);
    expect(result!.severity).toBe(RiskSeverity.Medium);
  });
});

describe("checkTinyBuy", () => {
  it("returns null when no volume provided", () => {
    expect(checkTinyBuy(BASE_INPUT)).toBeNull();
  });

  it("returns null when volume is zero", () => {
    expect(
      checkTinyBuy({ ...BASE_INPUT, attributedVolumeLamports: BigInt(0) }),
    ).toBeNull();
  });

  it("returns null when volume is above threshold", () => {
    expect(
      checkTinyBuy({
        ...BASE_INPUT,
        attributedVolumeLamports: BigInt(5_000_000_000),
      }),
    ).toBeNull();
  });

  it("returns medium-severity tiny_buy flag for small volume", () => {
    const result = checkTinyBuy({
      ...BASE_INPUT,
      attributedVolumeLamports: BigInt(500_000), // 0.0005 SOL
    });
    expect(result).not.toBeNull();
    expect(result!.riskType).toBe(RiskType.TinyBuy);
    expect(result!.severity).toBe(RiskSeverity.Medium);
  });
});

describe("checkAbnormalConversion", () => {
  it("returns null when click count is zero", () => {
    expect(
      checkAbnormalConversion({ ...BASE_INPUT, clickCount: 0 }),
    ).toBeNull();
  });

  it("returns null when buy intent count is low", () => {
    expect(
      checkAbnormalConversion({
        ...BASE_INPUT,
        clickCount: 100,
        buyIntentCount: 5,
      }),
    ).toBeNull();
  });

  it("returns null when ratio is below threshold", () => {
    expect(
      checkAbnormalConversion({
        ...BASE_INPUT,
        clickCount: 100,
        buyIntentCount: 50,
      }),
    ).toBeNull();
  });

  it("returns medium-severity flag for abnormal ratio", () => {
    const result = checkAbnormalConversion({
      ...BASE_INPUT,
      clickCount: 10,
      buyIntentCount: 10, // 100% ratio, > threshold, > 5
    });
    expect(result).not.toBeNull();
    expect(result!.riskType).toBe(RiskType.AbnormalConversion);
    expect(result!.severity).toBe(RiskSeverity.Medium);
  });
});

describe("evaluateRisk", () => {
  it("returns no flags for clean input", () => {
    const result = evaluateRisk(BASE_INPUT);
    expect(result.flags).toHaveLength(0);
    expect(result.riskLevel).toBeNull();
    expect(result.isHighRisk).toBe(false);
  });

  it("sets isHighRisk=true when self_buy flag is present", () => {
    const result = evaluateRisk({
      ...BASE_INPUT,
      buyerWallet: "AffiliateWallet11111111111111111111111111",
    });
    expect(result.isHighRisk).toBe(true);
    expect(result.riskLevel).toBe(RiskSeverity.High);
  });

  it("accumulates multiple flags correctly", () => {
    const result = evaluateRisk({
      ...BASE_INPUT,
      sameIpUaClickCount: 10,
      sameIpUaWindowMinutes: 10,
      attributedVolumeLamports: BigInt(500_000),
    });
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
    expect(result.riskLevel).toBe(RiskSeverity.Medium);
  });

  it("riskScore equals absolute sum of score deltas", () => {
    const result = evaluateRisk({
      ...BASE_INPUT,
      buyerWallet: "AffiliateWallet11111111111111111111111111",
    });
    const expectedScore = result.flags.reduce(
      (s, f) => s + Math.abs(f.scoreDelta),
      0,
    );
    expect(result.riskScore).toBe(expectedScore);
  });
});
