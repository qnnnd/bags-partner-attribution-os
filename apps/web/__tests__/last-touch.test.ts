/**
 * Last-touch attribution tests — §9.3 of the technical plan.
 *
 * Tests the resolveLastTouchWinners pure function which is the core of the
 * cross-affiliate last-touch resolution logic. This covers all business
 * scenarios described in the technical plan without requiring a live DB.
 *
 * Scenarios:
 *  A. Same session: A visit → B visit → buy_click → B wins
 *  B. Same session: A visit → B visit (no wallet) → B wins (click attribution)
 *  C. Same wallet: A wallet_connect → B wallet_connect → B wins
 *  D. Mixed: A has click only, B has wallet intent → B wins
 *  E. Non-last-touch affiliate does NOT appear as winner
 *  F. No events → no winners
 *  G. Single affiliate → always wins
 *  H. Wallet intent overrides session click for the same session
 */
import { describe, expect, it } from "vitest";
import { resolveLastTouchWinners } from "../lib/attribution-aggregator";

function ev(
  sessionId: string,
  affiliateId: string,
  eventType: string,
  walletAddress: string | null,
  offsetSeconds: number,
) {
  return {
    sessionId,
    affiliateId,
    eventType,
    walletAddress,
    createdAt: new Date(1_000_000 + offsetSeconds * 1000),
  };
}

describe("resolveLastTouchWinners", () => {
  it("A — same session: A visit then B visit → B is the last-touch winner", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-B", "visit", null, 60), // B is later
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("A+ — same session: A visit → B visit → buy_click on B → B wins", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-B", "visit", null, 60),
      ev("sess1", "aff-B", "buy_click", "wallet-W", 90),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("B — same session, no wallet: A visit → B visit → B wins (click attribution)", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-B", "visit", null, 300),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("C — same wallet: A wallet_connect → B wallet_connect → B wins", () => {
    const events = [
      ev("sess1", "aff-A", "wallet_connect", "wallet-W", 0),
      ev("sess2", "aff-B", "wallet_connect", "wallet-W", 300), // same wallet, different session, later
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("D — A has click only, B has wallet intent → B wins", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess2", "aff-B", "wallet_connect", "wallet-W", 0),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    // A is session winner for sess1 (no wallet) but sess1 has no wallet → A could win for sess1
    // sess2 has wallet → wallet winner (B) supersedes session winner for sess2
    // sess1 has no wallet → A is session winner → A also wins (different journey)
    expect(winners.has("aff-A")).toBe(true);
  });

  it("D2 — same session: A visit, then B wallet_connect → B wins (intent beats click)", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-B", "wallet_connect", "wallet-W", 60),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("E — non-last-touch affiliate does not appear as winner", () => {
    // User: sess1 → A first, then B last; sess2 → only C
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-B", "visit", null, 100), // B is last in sess1
      ev("sess2", "aff-C", "visit", null, 50),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-C")).toBe(true);
    expect(winners.has("aff-A")).toBe(false); // A was first in sess1, not last
  });

  it("F — no events → no winners", () => {
    const winners = resolveLastTouchWinners([]);
    expect(winners.size).toBe(0);
  });

  it("G — single affiliate → always the winner", () => {
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-A", "wallet_connect", "wallet-W", 30),
      ev("sess1", "aff-A", "buy_click", "wallet-W", 60),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-A")).toBe(true);
    expect(winners.size).toBe(1);
  });

  it("H — wallet intent overrides session click winner for same session", () => {
    // A is the last click in sess1, but B has a wallet intent in the same session
    const events = [
      ev("sess1", "aff-B", "wallet_connect", "wallet-W", 0),
      ev("sess1", "aff-A", "visit", null, 100), // A is latest visit but no intent
    ];
    const winners = resolveLastTouchWinners(events);
    // sess1 has a wallet → use walletLastTouch (B) not sessionLastTouch (A)
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });

  it("§9.3 rule 2 — cross-session wallet last-touch: wallet re-visits via B after A → B wins", () => {
    // Day 1: wallet-W visits via A
    // Day 2: wallet-W visits via B and buys → B should win for wallet-W's journey
    const events = [
      ev("sess1", "aff-A", "visit", null, 0),
      ev("sess1", "aff-A", "wallet_connect", "wallet-W", 10),
      ev("sess2", "aff-B", "visit", null, 3600),
      ev("sess2", "aff-B", "wallet_connect", "wallet-W", 3610), // same wallet, later
      ev("sess2", "aff-B", "outbound_to_bags", "wallet-W", 3620),
    ];
    const winners = resolveLastTouchWinners(events);
    expect(winners.has("aff-B")).toBe(true);
    expect(winners.has("aff-A")).toBe(false);
  });
});
