/**
 * Tests for on-chain buy candidate detection using mock fixtures.
 * No real network calls are made — all data comes from DEMO_FIXTURE_ONCHAIN_CANDIDATES.
 */
import { describe, it, expect } from "vitest";
import { MockBagsClient } from "../mock";
import { solscanTxLink } from "../solscan";
import {
  DEMO_FIXTURE_ONCHAIN_CANDIDATES,
  DEMO_FIXTURE_TOKEN_MINT,
} from "../fixtures";

const client = new MockBagsClient();

const ALICE_BUYER = "AliceBuyerWallet111111111111111111111111111111";
const BOB_BUYER = "BobBuyerWallet1111111111111111111111111111111";
const UNKNOWN_BUYER = "UnknownBuyer111111111111111111111111111111111";

describe("MockBagsClient.getWalletTokenActivity", () => {
  it("returns candidates for Alice buyer wallet with matching token mint", async () => {
    const since = new Date("2026-04-27T00:00:00Z");
    const candidates = await client.getWalletTokenActivity(
      ALICE_BUYER,
      DEMO_FIXTURE_TOKEN_MINT,
      since,
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.walletAddress).toBe(ALICE_BUYER);
    expect(candidates[0]!.tokenMint).toBe(DEMO_FIXTURE_TOKEN_MINT);
    expect(candidates[0]!.txSignature).toBeTruthy();
    expect(candidates[0]!.solscanLink).toContain("solscan.io/tx/");
    expect(candidates[0]!.timestamp).toBeInstanceOf(Date);
  });

  it("returns candidates for Bob buyer wallet", async () => {
    const since = new Date("2026-04-27T00:00:00Z");
    const candidates = await client.getWalletTokenActivity(
      BOB_BUYER,
      DEMO_FIXTURE_TOKEN_MINT,
      since,
    );
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.walletAddress).toBe(BOB_BUYER);
  });

  it("returns empty array for unknown wallet", async () => {
    const since = new Date("2026-04-27T00:00:00Z");
    const candidates = await client.getWalletTokenActivity(
      UNKNOWN_BUYER,
      DEMO_FIXTURE_TOKEN_MINT,
      since,
    );
    expect(candidates).toHaveLength(0);
  });

  it("returns empty array when since is after candidate timestamp", async () => {
    const future = new Date("2030-01-01T00:00:00Z");
    const candidates = await client.getWalletTokenActivity(
      ALICE_BUYER,
      DEMO_FIXTURE_TOKEN_MINT,
      future,
    );
    expect(candidates).toHaveLength(0);
  });

  it("returns empty array for mismatched token mint", async () => {
    const since = new Date("2026-04-27T00:00:00Z");
    const candidates = await client.getWalletTokenActivity(
      ALICE_BUYER,
      "WrongMint111111111111111111111111111111111111",
      since,
    );
    expect(candidates).toHaveLength(0);
  });

  it("fixture data matches DEMO_FIXTURE_ONCHAIN_CANDIDATES", () => {
    const aliceCandidates = DEMO_FIXTURE_ONCHAIN_CANDIDATES[ALICE_BUYER];
    expect(aliceCandidates).toBeDefined();
    expect(aliceCandidates!.length).toBeGreaterThan(0);
    expect(aliceCandidates![0]!.tokenMint).toBe(DEMO_FIXTURE_TOKEN_MINT);
  });
});

describe("solscanTxLink", () => {
  it("returns correct Solscan URL format", () => {
    const sig = "5xABCDEFGHIJKLMNOPQRSTUVWXYZ123456789abcdefghijklmnopqrstuvwxyz1234";
    const link = solscanTxLink(sig);
    expect(link).toBe(`https://solscan.io/tx/${sig}`);
  });

  it("all fixture candidates have valid solscanLink format", () => {
    for (const candidates of Object.values(DEMO_FIXTURE_ONCHAIN_CANDIDATES)) {
      for (const candidate of candidates) {
        expect(candidate.solscanLink).toMatch(/^https:\/\/solscan\.io\/tx\/.+/);
        expect(candidate.solscanLink).toBe(solscanTxLink(candidate.txSignature));
      }
    }
  });
});
