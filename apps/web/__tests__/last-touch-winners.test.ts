import { describe, expect, it } from "vitest";
import { resolveLastTouchWinners } from "../lib/attribution-aggregator";

type TestEvent = Parameters<typeof resolveLastTouchWinners>[0][number];

function ev(
  sessionId: string,
  affiliateId: string,
  eventType: string,
  at: string,
  walletAddress: string | null = null,
): TestEvent {
  return {
    sessionId,
    affiliateId,
    eventType,
    walletAddress,
    createdAt: new Date(at),
  };
}

describe("resolveLastTouchWinners", () => {
  it("same session without wallet: A visit then B visit => B wins", () => {
    const winners = resolveLastTouchWinners([
      ev("s1", "aff-A", "visit", "2026-04-27T10:00:00Z"),
      ev("s1", "aff-B", "visit", "2026-04-27T10:05:00Z"),
    ]);

    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("same session without wallet: A buy_click then B visit later => B wins by last touch", () => {
    const winners = resolveLastTouchWinners([
      ev("s1", "aff-A", "buy_click", "2026-04-27T10:00:00Z"),
      ev("s1", "aff-B", "visit", "2026-04-27T10:10:00Z"),
    ]);

    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("same wallet: A wallet intent then B wallet intent => B wins", () => {
    const winners = resolveLastTouchWinners([
      ev("s1", "aff-A", "wallet_connect", "2026-04-27T10:00:00Z", "wallet-1"),
      ev("s2", "aff-B", "wallet_connect", "2026-04-27T10:30:00Z", "wallet-1"),
    ]);

    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("wallet journey takes priority over session click winner for sessions with wallet", () => {
    const winners = resolveLastTouchWinners([
      ev("s1", "aff-A", "visit", "2026-04-27T10:00:00Z"),
      ev("s1", "aff-B", "wallet_connect", "2026-04-27T10:05:00Z", "wallet-1"),
      ev("s1", "aff-A", "visit", "2026-04-27T10:10:00Z"),
    ]);

    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });
});
